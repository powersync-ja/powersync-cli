import { BaseServiceSelfHostedConfig, ServiceCloudConfig } from '@powersync/cli-schemas';
import { readFileSync } from 'node:fs';
import { Document, isMap, isNode, isPair, isScalar, isSeq, Pair, parseDocument, YAMLMap } from 'yaml';

export type BuildServiceYamlOptions = {
  /**
   * The service configuration to render in the form of the provided template.
   */
  baseConfig: Partial<BaseServiceSelfHostedConfig | ServiceCloudConfig>;
  /**
   * A YAML comment block to attach to the top of the rendered YAML file, typically containing schema information and links to documentation.
   */
  schemaHeader: string;
  /**
   * The absolute path to the YAML template file to use for rendering. This file should contain all possible configuration options with comments.
   */
  templatePath: string;

  /**
   * For certain fields that are arrays of objects (e.g. replication->connections), if the provided config has an empty array, we want to replace it with a commented-out example from the template. This option allows specifying the paths to those fields in order to apply that replacement logic after the initial rendering of comments and missing fields.
   */
  templateReplacementPaths?: string[][];
};

/**
 * Renders a service YAML file from a concrete base config and a parseable template.
 * Given a service config, the rendering process involves:
 * - Adding comments to fields from the template.
 * - Adding commented-out snippets for missing fields from the template, placed at the end of their respective sections.
 * - Preserving the order of fields as defined in the template.
 *
 * The output is a YAML string that can be written to a file, with comments and structure that guide users in filling out missing information.
 */
export function buildServiceYaml({
  baseConfig,
  schemaHeader,
  templatePath,
  templateReplacementPaths
}: BuildServiceYamlOptions): string {
  const templateContent = readFileSync(templatePath, 'utf8');
  const templateDoc = parseDocument(templateContent);
  const outputDoc = new Document(baseConfig);

  // Both documents should be a YAML map at the root level.
  if (!isMap(templateDoc.contents) || !isMap(outputDoc.contents)) {
    throw new Error('Expected both template and base config to be YAML maps at the root level.');
  }

  // Recursively starts annotating the provided config given the template.
  annotateLevelFromTemplate({ outputMap: outputDoc.contents, templateMap: templateDoc.contents });

  /**
   * For some values, such as the replication->connections array or the client_auth->jwks->keys array,
   * we want to add a commented-out example from the template if the array (in the service config) is empty.
   * This allows users to see example options, and gives a quick path for them to configure the config.
   * This parsing is handled after the initial parsing of the template.
   * We want to avoid rendering incomplete YAML sections such as
   * ```yaml
   * replication:
   *   connections: # No content here
   *   # No content here
   * client_auth:
   * # etc
   * ```
   * This typically causes a validation error.
   * Instead, we want to render the section with a commented-out example from the template, such as:
   * ```yaml
   * #replication:
   * #  connections:
   *     # - name: example-connection
   *     #   host: example.com
   *     #   port: 1234
   * client_auth:
   *   jwks:
   * ```
   * This implements a replacement for those empty arrays.
   */
  for (const { path, shouldReplace } of [
    {
      path: ['replication', 'connections'],
      shouldReplace: baseConfig.replication?.connections?.length === 0
    },
    { path: ['client_auth', 'jwks', 'keys'], shouldReplace: baseConfig.client_auth?.jwks?.keys?.length === 0 },
    ...(templateReplacementPaths?.map((path) => ({ path, shouldReplace: true })) ?? [])
  ]) {
    if (!shouldReplace) continue;
    replaceListWithComment({
      outputRootDoc: outputDoc,
      path,
      templateDoc
    });
  }

  const renderedYaml = outputDoc.toString();
  return `${schemaHeader}\n\n${renderedYaml}`;
}

/**
 * Adds a comment to the target YAML node. The comment can be either a comment on the same line (comment) or a comment on the line before (commentBefore).
 */
function annotateComment(options: {
  appendComments?: boolean;
  comment?: null | string;
  commentBefore?: null | string;
  target: unknown;
}): void {
  const { appendComments = true, comment, commentBefore, target } = options;
  if (!comment && !commentBefore) return;

  if (isScalar(target)) {
    if (comment) target.comment = appendComments ? target.comment + '\n' + comment : comment;
    if (commentBefore)
      target.commentBefore = appendComments ? commentBefore + '\n\n' + target.commentBefore : commentBefore;
  } else if (isPair(target) && isScalar(target.key)) {
    if (comment) target.key.comment = appendComments ? target.key.comment + '\n' + comment : comment;
    if (commentBefore)
      target.key.commentBefore = appendComments ? commentBefore + '\n\n' + target.key.commentBefore : commentBefore;
  }
}

function copyNodeComments(source: unknown, target: unknown): void {
  if (!isNode(source) || !isNode(target)) return;
  target.comment = source.comment;
  target.commentBefore = source.commentBefore;
}

/**
 * Copies comments from the source YAML node to the target YAML node, including comments on the node itself, as well as comments on the key and value if the node is a pair. This ensures that all relevant comments from the template are preserved in the output YAML.
 */
function copyComments(options: { source: Pair; target: Pair }): void {
  const { source, target } = options;

  // Pair-level comments
  copyNodeComments(source, target);

  // Key comments
  copyNodeComments(source.key, target.key);

  if (isSeq(source.value) && isSeq(target.value) && target.value.items.length > 0) {
    // Avoid copying template block comments for sequences when we already have data
    // (e.g. replication->connections), otherwise example comments bleed into real configs.
    return;
  }

  // Value comments (covers scalars and maps that carry block comments before the value)
  copyNodeComments(source.value, target.value);
}

/**
 * Copies comments from the template to the output YAML at all levels, and appends optional template snippets for any missing keys.
 */
function annotateLevelFromTemplate(options: { outputMap: YAMLMap; templateMap: YAMLMap }): void {
  const { outputMap, templateMap } = options;
  // For items not present in the currentConfig, we'll add commented out snippets from the template at the end of the section.
  const missingPairs: Pair[] = [];

  for (const templatePair of templateMap.items) {
    const key = getPairKey(templatePair);
    if (!key) continue;

    const outputPair = outputMap.items.find((pair) => getPairKey(pair) === key);

    if (!outputMap.has(key) || !outputPair) {
      // We need to add this pair as a commented-out snippet later.
      missingPairs.push(templatePair);
      continue;
    }

    copyComments({
      source: templatePair,
      target: outputPair
    });

    // Add spacing between pairs
    if (isNode(outputPair.key) && isNode(templatePair.key)) {
      outputPair.key.spaceBefore = templatePair.key.spaceBefore;
    }

    // Walk the tree recursively for maps and sequences
    if (isMap(templatePair.value) && isMap(outputPair.value)) {
      annotateLevelFromTemplate({ outputMap: outputPair.value, templateMap: templatePair.value });
    } else if (isSeq(templatePair.value) && isSeq(outputPair.value)) {
      for (const outputItem of outputPair.value.items) {
        // For sequences, we need a method to match the items.
        // We currently only deeply traverse replication->connections and client_auth->jwks->keys, which both have a "type" or "kty" field we can use for matching.
        const matchingTemplateItem = templatePair.value.items.find((templateItem) => {
          if (isMap(templateItem) && isMap(outputItem)) {
            return (
              (templateItem.has('type') &&
                outputItem.has('type') &&
                templateItem.get('type') === outputItem.get('type')) ||
              (templateItem.has('kty') && outputItem.has('kty') && templateItem.get('kty') === outputItem.get('kty'))
            );
          }

          return false;
        });
        if (!matchingTemplateItem) continue;
        annotateLevelFromTemplate({
          outputMap: outputItem as YAMLMap,
          templateMap: matchingTemplateItem as YAMLMap
        });
      }
    }
  }

  if (missingPairs.length > 0) {
    matchSorting({
      orderedBy: templateMap.items,
      toBeSorted: missingPairs
    });
    // The fact that we use a node comment means the indentation will be handled automatically.
    const snippets = missingPairs.map((pair) => pairToYaml(pair)).join('\n');
    outputMap.comment = (outputMap.comment ? outputMap.comment + '\n' : '') + snippets;
  }

  matchSorting({
    orderedBy: templateMap.items,
    toBeSorted: outputMap.items
  });
}

function getPairKey(pair: Pair): null | string {
  if (!isScalar(pair.key)) return null;
  const { value } = pair.key;
  return typeof value === 'string' ? value : String(value);
}

function pairToYaml(pair: Pair): string {
  const map = new YAMLMap();
  map.items = [pair];
  return new Document(map).toString().trimEnd();
}

function replaceListWithComment(options: { outputRootDoc: Document; path: string[]; templateDoc: Document }): void {
  // This is only true if the array is present and empty.
  // If the replication connections array is empty, add a commented-out example from the template.
  const { outputRootDoc, path, templateDoc } = options;

  const parentOutputContainer = outputRootDoc.getIn(path.slice(0, -1), true) as YAMLMap;
  if (!isMap(parentOutputContainer)) {
    throw new Error(`Expected parent of ${path.slice(0, -1).join('.')} to be a YAML map.`);
  }

  const finalOutputKey = path.at(-1);
  const outputItemIndex = parentOutputContainer.items.findIndex((pair) => getPairKey(pair) === finalOutputKey);

  if (outputItemIndex === -1) {
    throw new Error(`Expected ${finalOutputKey} key to be present in the output YAML.`);
  }

  const outputItem = parentOutputContainer.items[outputItemIndex];

  const templatePair = templateDoc.getIn(path, true);
  const templateCommentString = pairToYaml(new Pair(finalOutputKey, templatePair));

  /**
   * We don't want any empty objects/maps in the output YAML.
   * That causes validation errors and requires additional effort from users to input.
   * Instead, if a map is empty, we traverse on level up and add the map item as a comment on
   * that level.
   */
  const siblingPair = parentOutputContainer.items[outputItemIndex + 1];
  if (siblingPair) {
    // Add this example as a comment on the next sibling key.
    // We also need to preserve the current comment on the current key.
    const previousCommentBefore =
      (isScalar(outputItem.key) && outputItem.key.commentBefore && `${outputItem.key.commentBefore}\n`) || '';
    annotateComment({ commentBefore: previousCommentBefore + templateCommentString, target: siblingPair });
  } else if (path.length === 1) {
    // If there is no sibling and we are at the root, we just need to append it as a comment to the main doc
    parentOutputContainer.comment = (parentOutputContainer.comment || '') + templateCommentString;
  } else {
    // Move one level up and add the example as a comment on the parent key
    return replaceListWithComment({
      outputRootDoc,
      path: path.slice(0, -1),
      templateDoc
    });
  }

  // Delete the original yaml node
  parentOutputContainer.delete(outputItem.key);
}

/**
 * Sorts on array of YAML items by the order of another array's keyed values.
 */
function matchSorting(params: { orderedBy: Pair[]; toBeSorted: Pair[] }) {
  const { orderedBy, toBeSorted } = params;
  const orderMap = new Map(orderedBy.map((item, index) => [getPairKey(item), index]));

  toBeSorted.sort((a, b) => {
    const aKey = getPairKey(a);
    const bKey = getPairKey(b);
    const aIndex = aKey ? (orderMap.get(aKey) ?? Number.POSITIVE_INFINITY) : Number.POSITIVE_INFINITY;
    const bIndex = bKey ? (orderMap.get(bKey) ?? Number.POSITIVE_INFINITY) : Number.POSITIVE_INFINITY;
    return aIndex - bIndex;
  });
}
