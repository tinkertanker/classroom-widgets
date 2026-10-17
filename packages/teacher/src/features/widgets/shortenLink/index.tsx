import { isDesktopDashboardMode } from '@shared/utils/dashboardMode';
import { isNativeDesktop } from '@shared/utils/nativeBridge';
import ShortenLink from './ShortenLink';
import DesktopShortenLink from './DesktopShortenLink';

export default isDesktopDashboardMode() || isNativeDesktop()
  ? DesktopShortenLink
  : ShortenLink;
