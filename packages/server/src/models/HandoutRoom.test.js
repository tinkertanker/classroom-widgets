const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const HandoutRoom = require('./HandoutRoom');

describe('HandoutRoom', () => {
  it('reports its type and starts active with no items', () => {
    const room = new HandoutRoom('CODE1', 'w-1');
    assert.equal(room.getType(), 'handout');
    assert.equal(room.isActive, true);
    assert.deepEqual(room.getItems(), []);
    assert.equal(room.getItemCount(), 0);
  });

  it('adds an item with a generated id and timestamp', () => {
    const room = new HandoutRoom('CODE1', 'w-1');
    const item = room.addItem('hello world', false);

    assert.ok(item.id);
    assert.equal(item.content, 'hello world');
    assert.equal(item.isLink, false);
    assert.equal(typeof item.timestamp, 'number');
    assert.equal(room.getItemCount(), 1);
    assert.deepEqual(room.getItems(), [item]);
  });

  it('has no enforced capacity limit today', () => {
    const room = new HandoutRoom('CODE1', 'w-1');
    for (let i = 0; i < 50; i++) {
      const item = room.addItem(`item-${i}`, false);
      assert.ok(item, `item ${i} should be accepted`);
    }
    assert.equal(room.getItemCount(), 50);
  });

  it('deletes an existing item by id', () => {
    const room = new HandoutRoom('CODE1', 'w-1');
    const item = room.addItem('to remove', true);

    assert.equal(room.deleteItem(item.id), true);
    assert.equal(room.getItemCount(), 0);
  });

  it('is a no-op deleting a nonexistent item', () => {
    const room = new HandoutRoom('CODE1', 'w-1');
    room.addItem('keep me', false);

    assert.equal(room.deleteItem('does-not-exist'), false);
    assert.equal(room.getItemCount(), 1);
  });

  it('clears all items', () => {
    const room = new HandoutRoom('CODE1', 'w-1');
    room.addItem('one', false);
    room.addItem('two', false);

    room.clearAllItems();

    assert.equal(room.getItemCount(), 0);
    assert.deepEqual(room.getItems(), []);
  });

  it('includes handout-specific fields in toJSON', () => {
    const room = new HandoutRoom('CODE1', 'w-1');
    const item = room.addItem('content', true);

    const json = room.toJSON();

    assert.equal(json.type, 'handout');
    assert.equal(json.code, 'CODE1');
    assert.deepEqual(json.items, [item]);
    assert.equal(json.itemCount, 1);
  });
});
