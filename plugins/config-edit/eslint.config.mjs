import rootConfig from '../../eslint.config.mjs';

export default [...rootConfig, { ignores: ['editor-dist/**'] }];
