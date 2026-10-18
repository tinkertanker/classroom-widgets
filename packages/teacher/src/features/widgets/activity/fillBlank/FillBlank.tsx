import React from 'react';
import type { WidgetProps } from '../../shared/widgetProps';
import FillBlankWidget from './FillBlankWidget';
import { fillBlankVariant } from './variants';

function FillBlank(props: WidgetProps) {
  return <FillBlankWidget {...props} variant={fillBlankVariant} />;
}

export default FillBlank;
