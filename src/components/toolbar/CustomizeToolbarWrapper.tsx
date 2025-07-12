import React, { useState } from 'react';
import CustomizeToolbar from './CustomizeToolbar';

interface CustomizeToolbarWrapperProps {
  customWidgets: number[];
  setCustomWidgets: (widgets: number[]) => void;
  widgetNames: Record<number, string>;
  getWidgetIcon: (widgetType: number) => React.ReactElement;
  onClose: () => void;
}

const CustomizeToolbarWrapper: React.FC<CustomizeToolbarWrapperProps> = ({
  customWidgets,
  setCustomWidgets,
  widgetNames,
  getWidgetIcon,
  onClose
}) => {
  // Local state for managing changes within the dialog
  const [localSelectedWidgets, setLocalSelectedWidgets] = useState<number[]>(customWidgets);

  // Create AllComponentData from the provided names and icons
  const AllComponentData = Object.keys(widgetNames).map(key => {
    const widgetType = Number(key);
    return {
      index: widgetType,
      name: widgetNames[widgetType],
      icon: getWidgetIcon(widgetType)
    };
  });

  // Handle save - update parent state and close
  const handleSave = () => {
    setCustomWidgets(localSelectedWidgets);
    localStorage.setItem('customToolbarWidgets', JSON.stringify(localSelectedWidgets));
    onClose();
  };

  return (
    <CustomizeToolbar
      selectedToolbarWidgets={localSelectedWidgets}
      setSelectedToolbarWidgets={setLocalSelectedWidgets}
      AllComponentData={AllComponentData}
      onSave={handleSave}
    />
  );
};

export default CustomizeToolbarWrapper;