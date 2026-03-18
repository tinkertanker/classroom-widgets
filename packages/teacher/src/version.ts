// Application version configuration - reads from root package.json (source of truth)
import packageJson from '../../../package.json';

export const APP_VERSION = packageJson.version;

// You can also export additional version-related information
export const VERSION_INFO = {
  version: APP_VERSION,
  codename: 'Classroom Widgets'
};