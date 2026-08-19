const Room = require('./Room');

/**
 * Room class to manage handout sessions where teachers push content to students
 */
class HandoutRoom extends Room {
  constructor(code, widgetId = null) {
    super(code, widgetId);
    this.items = [];
    this.isActive = true; // Handouts are visible to students by default
  }

  getType() {
    return 'handout';
  }

  /**
   * Add a new item to the handout
   * @param {string} content - The text or URL content
   * @param {boolean} isLink - Whether the content is a clickable link
   * @returns {Object} The created item
   */
  addItem(content, isLink) {
    const item = {
      id: this._generateId(),
      content,
      isLink,
      timestamp: Date.now()
    };
    return this._addToList(this.items, item);
  }

  /**
   * Delete an item by ID
   * @param {string} itemId - The ID of the item to delete
   * @returns {boolean} Whether the item was found and deleted
   */
  deleteItem(itemId) {
    return this._removeFromList(this.items, itemId);
  }

  /**
   * Clear all items
   */
  clearAllItems() {
    this.items = [];
    this.updateActivity();
  }

  /**
   * Get all items
   * @returns {Array} All items in the handout
   */
  getItems() {
    return this.items;
  }

  /**
   * Get item count
   * @returns {number} Number of items
   */
  getItemCount() {
    return this.items.length;
  }

  /**
   * Override toJSON to include handout specific data
   */
  toJSON() {
    return {
      ...super.toJSON(),
      items: this.items,
      itemCount: this.getItemCount()
    };
  }
}

module.exports = HandoutRoom;
