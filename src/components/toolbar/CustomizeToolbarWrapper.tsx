import React, { useState } from 'react';
import CustomizeToolbar from './CustomizeToolbar';

interface CustomizeToolbarWrapperProps {
  selectedToolbarWidgets: number[];
  setSelectedToolbarWidgets: (widgets: number[]) => void;
  AllComponentData: any;
  onClose: () => void;
}

const CustomizeToolbarWrapper: React.FC<CustomizeToolbarWrapperProps> = ({
  selectedToolbarWidgets,
  setSelectedToolbarWidgets,
  AllComponentData,
  onClose
}) => {
  // Local state for managing changes within the dialog
  const [localSelectedWidgets, setLocalSelectedWidgets] = useState<number[]>(selectedToolbarWidgets);

  // Handle save - update parent state and close
  const handleSave = () => {
    setSelectedToolbarWidgets(localSelectedWidgets);
    localStorage.setItem('toolbarWidgets', JSON.stringify(localSelectedWidgets));
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