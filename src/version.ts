// Application version configuration - reads directly from package.json
import packageJson from '../package.json';

export const APP_VERSION = packageJson.version;

// You can also export additional version-related information
export const VERSION_INFO = {
  version: APP_VERSION,
  codename: 'Classroom Widgets'
};