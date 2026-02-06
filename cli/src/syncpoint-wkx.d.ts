// Required for the @powersync/service-sync-rules package
declare module '@syncpoint/wkx' {
  export class Geometry {
    static parse(blob: unknown): Geometry | null;
    toGeoJSON(): unknown;
    toWkt(): string;
  }

  export class Point extends Geometry {
    x: number;
    y: number;
  }

  export namespace wkx {
    export { Geometry, Point };
  }
  export default wkx;
}
