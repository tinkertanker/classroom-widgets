import React from 'react';
import type { WidgetProps } from '../../shared/widgetProps';
import FillBlankWidget from './FillBlankWidget';
import { codeFillBlankVariant } from './variants';

function CodeFillBlank(props: WidgetProps) {
  return <FillBlankWidget {...props} variant={codeFillBlankVariant} />;
}

export default CodeFillBlank;
