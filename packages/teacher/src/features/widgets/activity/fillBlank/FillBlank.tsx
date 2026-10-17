import React from 'react';
import { withWidgetProvider, type WidgetProps } from '../../shared/withWidgetProvider';
import FillBlankWidget from './FillBlankWidget';
import { fillBlankVariant } from './variants';

function FillBlank(props: WidgetProps) {
  return <FillBlankWidget {...props} variant={fillBlankVariant} />;
}

export default withWidgetProvider(FillBlank, 'FillBlank');
