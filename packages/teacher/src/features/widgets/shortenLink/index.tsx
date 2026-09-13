import { isDesktopDashboardMode } from '@shared/utils/dashboardMode';
import ShortenLink from './shortenLink';
import DesktopShortenLink from './DesktopShortenLink';

export default isDesktopDashboardMode() || window.__CLASSROOM_WIDGETS_MACOS__
  ? DesktopShortenLink
  : ShortenLink;
