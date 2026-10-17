import React from 'react';
import { withWidgetProvider, type WidgetProps } from '../../shared/withWidgetProvider';
import FillBlankWidget from './FillBlankWidget';
import { codeFillBlankVariant } from './variants';

function CodeFillBlank(props: WidgetProps) {
  return <FillBlankWidget {...props} variant={codeFillBlankVariant} />;
}

export default withWidgetProvider(CodeFillBlank, 'CodeFillBlank');
