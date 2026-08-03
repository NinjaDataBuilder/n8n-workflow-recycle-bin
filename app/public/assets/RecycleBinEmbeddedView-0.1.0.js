import { h } from './vue.runtime.esm-bundler-BZlJNr-r.js';

export default {
  name: 'RecycleBinEmbeddedView',
  render() {
    return h('iframe', {
      src: '/recycle-bin/',
      title: 'Workflow Recycle Bin',
      style: {
        border: '0',
        display: 'block',
        width: '100%',
        minHeight: 'calc(100vh - 48px)',
      },
    });
  },
};
