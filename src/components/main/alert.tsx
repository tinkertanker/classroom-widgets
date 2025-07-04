// NOTE: Lazy so this is NOT a reusable component !!!

import * as React from 'react';

function AlertDialogExample({ onDeleteConfirm }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const cancelRef = React.useRef<HTMLButtonElement>(null);

  const onOpen = () => setIsOpen(true);
  const onClose = () => setIsOpen(false);

  const handleDelete = () => {
    onDeleteConfirm(true);
    onClose();
  };

  return (
    <>
      <button
        className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors duration-200"
        onClick={onOpen}
      >
        Delete List
      </button>

      {isOpen && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-50"
            onClick={onClose}
          />
          
          {/* Dialog */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
              {/* Header */}
              <div className="px-6 py-4 border-b">
                <h2 className="text-lg font-bold">Delete List</h2>
              </div>

              {/* Body */}
              <div className="px-6 py-4">
                <p>Are you sure? You can't undo this action afterwards.</p>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t flex justify-end space-x-3">
                <button
                  ref={cancelRef}
                  onClick={onClose}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors duration-200"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}

export default AlertDialogExample;