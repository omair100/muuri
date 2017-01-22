/*!
 * Muuri v0.3.0-dev
 * https://github.com/haltu/muuri
 * Copyright (c) 2015, Haltu Oy
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

/*

TODO v0.3.0
===========
* [ ] Connected Muuri instance. (WIP)
* [ ] Test how form elements work inside items.
* [ ] Drop item on empty slot.
* [ ] Autoscroll container(s) on drag.
* [ ] Update docs.
* [ ] Add more unit tests.
* [ ] Test usage on node and bower. Make sure everything works as advertised.
* [ ] Update website.

*/

(function (global, factory) {

  var libName = 'Muuri';
  var Velocity;
  var Hammer;

  if (typeof define === 'function' && define.amd) {
    define(function (require) {
      Velocity = require.defined && require.defined('velocity') ? require('velocity') : undefined;
      Hammer = require.defined && require.defined('hammer') ? require('hammer') : undefined;
      return factory(global, libName, Velocity, Hammer);
    });
  }
  else if (typeof module === 'object' && module.exports) {
    try { Velocity = require('velocity-animate'); } catch (e) {}
    try { Hammer = require('hammerjs'); } catch (e) {}
    module.exports = factory(global, libName, Velocity, Hammer);
  }
  else {
    Velocity = typeof global.jQuery === 'function' ? global.jQuery.Velocity : global.Velocity;
    Hammer = global.Hammer;
    global[libName] = factory(global, libName, Velocity, Hammer);
  }

}(this, function (global, libName, Velocity, Hammer, undefined) {

  'use strict';

  // Id which is used for Muuri instances and Item instances. Incremented every
  // time it is used.
  var uuid = 0;

  // Get the supported transform style property.
  var transform = getSupportedStyle('transform');

  // Do transformed elements leak fixed elements? According W3C specification
  // (about transform rendering) a transformed element should contain fixed
  // elements, but not every browser follows the spec. So we need to test it.
  var transformLeaksFixed = doesTransformLeakFixed();

  // Event names.
  var evRefresh = 'refresh';
  var evRefreshItems = 'refreshitems';
  var evSynchronizeItems = 'synchronizeitems';
  var evLayoutItemsStart = 'layoutitemsstart';
  var evLayoutItemsEnd = 'layoutitemsend';
  var evShowItemsStart = 'showitemsstart';
  var evShowItemsEnd = 'showitemsend';
  var evHideItemsStart = 'hideitemsstart';
  var evHideItemsEnd = 'hideitemsend';
  var evMoveItem = 'moveitem';
  var evSendItem = 'senditem';
  var evReceiveItem = 'receiveitem';
  var evAddItems = 'additems';
  var evRemoveItems = 'removeitems';
  var evDragItemStart = 'dragitemstart';
  var evDragItemMove = 'dragitemmove';
  var evDragItemScroll = 'dragitemscroll';
  var evDragItemEnd = 'dragitemend';
  var evReleaseItemStart = 'releaseitemstart';
  var evReleaseItemEnd = 'releaseitemend';
  var evDestroy = 'destroy';

  /**
   * Muuri
   * *****
   */

  /**
   * Creates a new Muuri instance.
   *
   * @public
   * @class
   * @param {Object} settings
   * @param {HTMLElement} settings.container
   * @param {Array|NodeList} settings.items
   * @param {?Function|Object} [settings.show]
   * @param {Number} [settings.show.duration=300]
   * @param {String} [settings.show.easing="ease"]
   * @param {Object} [settings.show.styles]
   * @param {?Function|Object} [settings.hide]
   * @param {Number} [settings.hide.duration=300]
   * @param {String} [settings.hide.easing="ease"]
   * @param {Object} [settings.hide.styles]
   * @param {Function|Object} [settings.layout]
   * @param {Boolean} [settings.layout.fillGaps=false]
   * @param {Boolean} [settings.layout.horizontal=false]
   * @param {Boolean} [settings.layout.alignRight=false]
   * @param {Boolean} [settings.layout.alignBottom=false]
   * @param {Boolean|Number} [settings.layoutOnResize=100]
   * @param {Boolean} [settings.layoutOnInit=true]
   * @param {Number} [settings.layoutDuration=300]
   * @param {String} [settings.layoutEasing="ease"]
   * @param {Boolean} [settings.dragEnabled=false]
   * @param {?HtmlElement} [settings.dragContainer=null]
   * @param {?Function} [settings.dragStartPredicate=null]
   * @param {Boolean} [settings.dragSort=true]
   * @param {Number} [settings.dragSortInterval=50]
   * @param {?Function|Object} [settings.dragSortPredicate]
   * @param {Number} [settings.dragSortPredicate.threshold=50]
   * @param {String} [settings.dragSortPredicate.action="move"]
   * @param {Number} [settings.dragReleaseDuration=300]
   * @param {String} [settings.dragReleaseEasing="ease"]
   * @param {String} [settings.containerClass="muuri"]
   * @param {String} [settings.itemClass="muuri-item"]
   * @param {String} [settings.itemVisibleClass="muuri-item-visible"]
   * @param {String} [settings.itemHiddenClass="muuri-item-hidden"]
   * @param {String} [settings.itemPositioningClass="muuri-item-positioning"]
   * @param {String} [settings.itemDraggingClass="muuri-item-dragging"]
   * @param {String} [settings.itemReleasingClass="muuri-item-releasing"]
   */
  function Muuri(settings) {

    var inst = this;
    var debouncedLayout;

    // Merge user settings with default settings.
    var stn = inst._settings = mergeSettings(Muuri.defaultSettings, settings);

    // Make sure a valid container element is provided before going continuing.
    if (!document.body.contains(stn.container)) {
      throw new Error('Container must be an existing DOM element');
    }

    // Setup container element.
    inst._element = stn.container;
    addClass(stn.container, stn.containerClass);

    // Instance id.
    inst._id = ++uuid;

    // Reference to the currently used Layout instance.
    inst._layout = null;

    // Create private Emitter instance.
    inst._emitter = new Muuri.Emitter();

    // Setup show and hide animations for items.
    inst._itemShowHandler = typeof stn.show === 'function' ? stn.show() : getItemVisbilityHandler('show', stn.show);
    inst._itemHideHandler = typeof stn.hide === 'function' ? stn.hide() : getItemVisbilityHandler('hide', stn.hide);

    // Calculate container element's initial dimensions and offset.
    inst.refresh();

    // Setup initial items.
    inst._items = Array.prototype.slice.call(stn.items).map(function (element) {
      return new Muuri.Item(inst, element);
    });

    // Layout on window resize if the layoutOnResize option is enabled.
    if (typeof stn.layoutOnResize === 'number' || stn.layoutOnResize === true) {

      debouncedLayout = debounce(function () {
        inst.refresh().refreshItems().layoutItems();
      }, Math.max(0, parseInt(stn.layoutOnResize) || 0));

      inst._resizeHandler = function () {
        debouncedLayout();
      };

      global.addEventListener('resize', inst._resizeHandler);

    }

    // Do initial layout if necessary.
    if (stn.layoutOnInit) {
      inst.layoutItems(true);
    }

  }

  /**
   * Muuri - Public properties
   * *************************
   */

  /**
   * @see Item
   */
  Muuri.Item = Item;

  /**
   * @see Drag
   */
  Muuri.Drag = Drag;

  /**
   * @see Layout
   */
  Muuri.Layout = Layout;

  /**
   * @see Animate
   */
  Muuri.AnimateLayout = Animate;

  /**
   * @see Animate
   */
  Muuri.AnimateVisibility = Animate;

  /**
   * @see Emitter
   */
  Muuri.Emitter = Emitter;

  /**
   * Default settings for Muuri instance.
   *
   * @public
   * @memberof Muuri
   */
  Muuri.defaultSettings = {

    // Container
    container: null,

    // Items
    items: [],

    // Show/hide animations
    show: {
      duration: 300,
      easing: 'ease',
      styles: {
        opacity: 1,
        scale: 1
      }
    },
    hide: {
      duration: 300,
      easing: 'ease',
      styles: {
        opacity: 0,
        scale: 0.5
      }
    },

    // Layout
    layout: {
      fillGaps: false,
      horizontal: false,
      alignRight: false,
      alignBottom: false
    },
    layoutOnResize: 100,
    layoutOnInit: true,
    layoutDuration: 300,
    layoutEasing: 'ease',

    // Drag & Drop
    dragEnabled: false,
    dragContainer: null,
    dragStartPredicate: null,
    dragSort: true,
    dragSortInterval: 50,
    dragSortPredicate: {
      threshold: 50,
      action: 'move'
    },
    dragReleaseDuration: 300,
    dragReleaseEasing: 'ease',

    // Classnames
    containerClass: 'muuri',
    itemClass: 'muuri-item',
    itemVisibleClass: 'muuri-item-shown',
    itemHiddenClass: 'muuri-item-hidden',
    itemPositioningClass: 'muuri-item-positioning',
    itemDraggingClass: 'muuri-item-dragging',
    itemReleasingClass: 'muuri-item-releasing'

  };

  /**
   * Muuri - Public prototype methods
   * ********************************
   */

  /**
   * Get the instance element.
   *
   * @public
   * @memberof Muuri.prototype
   * @returns {HTMLElement}
   */
  Muuri.prototype.getElement = function () {

    return this._element;

  };

  /**
   * Get instance's cached dimensions and offsets. Basically the same data as
   * provided by element.getBoundingClientRect() method, just cached. The cached
   * dimensions and offsets are subject to change whenever layoutItems or
   * refresh method is called. Note that Muuri uses rounded values in all
   * calculations.
   *
   * @public
   * @memberof Muuri.prototype
   * @returns {Object}
   */
  Muuri.prototype.getRect = function () {

    return {
      width: this._width,
      height: this._height,
      left: this._offset.left,
      right: this._offset.left + this._width,
      top: this._offset.top,
      bottom: this._offset.top + this._height
    };

  };

  /**
   * Get all items. Optionally you can provide specific targets (indices or
   * elements) and filter the results by the items' state (active/inactive).
   * Note that the returned array is not the same object used by the instance so
   * modifying it will not affect instance's items. All items that are not found
   * are omitted from the returned array.
   *
   * @public
   * @memberof Muuri.prototype
   * @param {Array|HTMLElement|Item|NodeList|Number} [targets]
   * @param {String} [state]
   * @returns {Array} Array of Muuri item instances.
   */
  Muuri.prototype.getItems = function (targets, state) {

    var inst = this;
    var hasTargets = targets && typeof targets !== 'string';
    var targetItems = !hasTargets ? null : isNodeList(targets) ? Array.prototype.slice.call(targets) : [].concat(targets);
    var targetState = !hasTargets ? targets : state;
    var ret = [];
    var isActive;
    var isInactive;
    var item;
    var i;

    // Sanitize target state.
    targetState = typeof targetState === 'string' ? targetState : null;

    // If target state or target items are defined return filtered results.
    if (targetState || targetItems) {

      targetItems = targetItems || inst._items;
      isActive = targetState === 'active';
      isInactive = targetState === 'inactive';

      for (i = 0; i < targetItems.length; i++) {
        item = hasTargets ? inst._getItem(targetItems[i]) : targetItems[i];
        if (item && (!targetState || (isActive && item._isActive) || (isInactive && !item._isActive))) {
          ret[ret.length] = item;
        }
      }

      return ret;

    }

    // Otherwise return all items.
    else {

      return ret.concat(inst._items);

    }

  };

  /**
   * Bind an event listener.
   *
   * @public
   * @memberof Muuri.prototype
   * @param {String} event
   * @param {Function} listener
   * @returns {Muuri} returns the Muuri instance.
   */
  Muuri.prototype.on = function (event, listener) {

    this._emitter.on(event, listener);

    return this;

  };

  /**
   * Unbind an event listener.
   *
   * @public
   * @memberof Muuri.prototype
   * @param {String} event
   * @param {Function} listener
   * @returns {Muuri} returns the Muuri instance.
   */
  Muuri.prototype.off = function (event, listener) {

    this._emitter.off(event, listener);

    return this;

  };

  /**
   * Calculate and cache the dimensions and offsets of the container element.
   *
   * @public
   * @memberof Muuri.prototype
   * @returns {Muuri} returns the Muuri instance.
   */
  Muuri.prototype.refresh = function () {

    var inst = this;
    var element = inst._element;
    var sides = ['left', 'right', 'top', 'bottom'];
    var rect = element.getBoundingClientRect();
    var side;
    var i;

    inst._offset = inst._offset || {};
    inst._border = inst._border || {};
    inst._padding = inst._padding || {};

    // Update width and height.
    inst._width = Math.round(rect.width);
    inst._height = Math.round(rect.height);

    // Update offset.
    inst._offset.left = Math.round(rect.left);
    inst._offset.top = Math.round(rect.top);

    // Update borders and paddings.
    for (i = 0; i < sides.length; i++) {
      side = sides[i];
      inst._border[side] = Math.round(getStyleAsFloat(element, 'border-' + side + '-width'));
      inst._padding[side] = Math.round(getStyleAsFloat(element, 'padding-' + side));
    }

    // Emit refresh event.
    inst._emitter.emit(evRefresh);

    return inst;

  };

  /**
   * Recalculate the width and height of the provided targets. If no targets are
   * provided all active items will be refreshed.
   *
   * @public
   * @memberof Muuri.prototype
   * @param {Array|HTMLElement|Item|Number} [items]
   * @returns {Muuri} returns the Muuri instance.
   */
  Muuri.prototype.refreshItems = function (items) {

    var inst = this;
    var targetItems = inst.getItems(items || 'active');
    var i;

    for (i = 0; i < targetItems.length; i++) {
      targetItems[i]._refresh();
    }

    // Emit refreshitems event.
    inst._emitter.emit(evRefreshItems, targetItems);

    return inst;

  };

  /**
   * Add new items by providing the elements you wish to add to the instance and
   * optionally provide the index where you want the items to be inserted into.
   * All elements that are not already children of the container element will be
   * automatically appended to the container. If an element has it's CSS display
   * property set to none it will be marked as inactive during the initiation
   * process. As long as the item is inactive it will not be part of the layout,
   * but it will retain it's index. You can activate items at any point
   * with muuri.show() method. This method will automatically call
   * muuri.layoutItems() if one or more of the added elements are visible. If
   * only hidden items are added no layout will be called. All the new visible
   * items are positioned without animation during their first layout.
   *
   * @public
   * @memberof Muuri.prototype
   * @param {Array|HTMLElement} elements
   * @param {Number} [index=-1]
   * @returns {Array}
   */
  Muuri.prototype.addItems = function (elements, index) {

    var inst = this;
    var targetElements = [].concat(elements);
    var newItems = [];
    var items = inst._items;
    var needsRelayout = false;
    var elementIndex;
    var item;
    var i;

    // Filter out all elements that exist already in current instance.
    for (i = 0; i < items.length; i++) {
      elementIndex = targetElements.indexOf(items[i]._element);
      if (elementIndex > -1) {
        targetElements.splice(elementIndex, 1);
      }
    }

    // Return early if there are no valid items.
    if (!targetElements.length) {
      return newItems;
    }

    // Create new items.
    for (i = 0; i < targetElements.length; i++) {
      item = new Muuri.Item(inst, targetElements[i]);
      newItems[newItems.length] = item;
      if (item._isActive) {
        needsRelayout = true;
        item._noLayoutAnimation = true;
      }
    }

    // Add the new items to the items collection to correct index.
    insertItemsToArray(items, newItems, index);

    // If relayout is needed.
    if (needsRelayout) {
      inst.layoutItems();
    }

    // Emit add event.
    inst._emitter.emit(evAddItems, newItems);

    // Return new items.
    return newItems;

  };

  /**
   * Remove items from the instance.
   *
   * @public
   * @memberof Muuri.prototype
   * @param {Array|HTMLElement|Item|Number} items
   * @param {Boolean} [removeElement=false]
   * @returns {Array} The indices of removed items.
   */
  Muuri.prototype.removeItems = function (items, removeElement) {

    var inst = this;
    var targetItems = inst.getItems(items);
    var indices = [];
    var needsRelayout = false;
    var item;
    var i;

    // Remove the individual items.
    for (i = 0; i < targetItems.length; i++) {
      item = targetItems[i];
      if (item._isActive) {
        needsRelayout = true;
      }
      indices[indices.length] = item._destroy(removeElement);
    }

    // If relayout is needed.
    if (needsRelayout) {
      inst.layoutItems();
    }

    // Emit remove event.
    inst._emitter.emit(evRemoveItems, indices);

    return indices;

  };

  /**
   * Order the item elements to match the order of the items. If the item's
   * element is not a child of the container it is ignored and left untouched.
   * This comes handy if you need to keep the DOM structure matched with the
   * order of the items.
   *
   * @public
   * @memberof Muuri.prototype
   * @returns {Muuri} returns the Muuri instance.
   */
  Muuri.prototype.synchronizeItems = function () {

    var inst = this;
    var container = inst._element;
    var items = inst._items;
    var fragment;
    var element;
    var i;

    // Append all elements in order to the container element.
    if (items.length) {
      for (i = 0; i < items.length; i++) {
        element = items[i]._element;
        if (element.parentNode === container) {
          fragment = fragment || document.createDocumentFragment();
          fragment.appendChild(element);
        }
      }
      if (fragment) {
        container.appendChild(fragment);
      }
    }

    // Emit synchronize event.
    inst._emitter.emit(evSynchronizeItems);

    return inst;

  };

  /**
   * Calculate and apply Muuri instance's item positions.
   *
   * @public
   * @memberof Muuri.prototype
   * @param {Boolean} [instant=false]
   * @param {Function} [callback]
   * @returns {Muuri} returns the Muuri instance.
   */
  Muuri.prototype.layoutItems = function (instant, callback) {

    var inst = this;
    var emitter = inst._emitter;
    var cb = typeof instant === 'function' ? instant : callback;
    var isInstant = instant === true;
    var layout = new Muuri.Layout(inst);
    var counter = 0;
    var itemsLength = layout.items.length;
    var completed = [];
    var item;
    var position;
    var i;

    // Try to finish the layout procedure.
    function tryFinish(interrupted, item) {

      // Push all items to the completed items array which were not interrupted.
      if (!interrupted) {
        completed[completed.length] = item;
      }

      // After all items have finished their animations call callback and emit
      // layoutend event.
      if (++counter === itemsLength) {
        if (typeof cb === 'function') {
          cb(completed);
        }
        emitter.emit(evLayoutItemsEnd, completed);
      }

    }

    // Update the current layout data reference.
    inst._layout = layout;

    // Emit layoutstart event.
    emitter.emit(evLayoutItemsStart, layout.items);

    // Set container's height if needed.
    if (layout.setHeight) {
      setStyles(inst._element, {
        height: layout.height + 'px'
      });
      inst._height = layout.height;
    }

    // Set container's width if needed.
    if (layout.setWidth) {
      setStyles(inst._element, {
        width: layout.width + 'px'
      });
      inst._width = layout.width;
    }

    // If there are no items let's finish quickly.
    if (!itemsLength) {

      tryFinish(true);

    }

    // If there are items let's position them.
    else {

      for (i = 0; i < layout.items.length; i++) {

        item = layout.items[i];
        position = layout.slots[item._id];

        // Update item's position.
        item._left = position.left + inst._padding.left;
        item._top = position.top + inst._padding.top;

        // Layout non-dragged items.
        if (item._drag && item._drag._drag.isActive) {
          tryFinish(false, item);
        }
        else {
          item._layout(isInstant, tryFinish);
        }

      }

    }

    return inst;

  };

  /**
   * Show instance items.
   *
   * @public
   * @memberof Muuri.prototype
   * @param {Array|HTMLElement|Item|Number} items
   * @param {Boolean} [instant=false]
   * @param {Function} [callback]
   * @returns {Muuri} returns the Muuri instance.
   */
  Muuri.prototype.showItems = function (items, instant, callback) {

    setVisibility(this, 'show', items, instant, callback);

    return this;

  };

  /**
   * Hide instance items.
   *
   * @public
   * @memberof Muuri.prototype
   * @param {Array|HTMLElement|Item|Number} items
   * @param {Boolean} [instant=false]
   * @param {Function} [callback]
   * @returns {Muuri} returns the Muuri instance.
   */
  Muuri.prototype.hideItems = function (items, instant, callback) {

    setVisibility(this, 'hide', items, instant, callback);

    return this;

  };

  /**
   * Move item to another index or in place of another item.
   *
   * @public
   * @memberof Muuri.prototype
   * @param {HTMLElement|Item|Number} item
   * @param {HTMLElement|Item|Number} position
   * @param {String} [action="move"]
   *   - Accepts either "move" or "swap". "move" moves item in place of another
   *     item and "swap" swaps position of items.
   * @returns {Muuri} returns the Muuri instance.
   */
  Muuri.prototype.moveItem = function (item, position, action) {

    var inst = this;
    var items = inst._items;
    var from;
    var to;
    var isSwap;

    // Return immediately, if moving item is not possible.
    if (items.length < 2) {
      return inst;
    }

    from = inst._getItem(item);
    to = inst._getItem(position);
    isSwap = action === 'swap';

    if (from && to && (from !== to)) {
      if (isSwap) {
        arraySwap(items, items.indexOf(from), items.indexOf(to));
      }
      else {
        arrayMove(items, items.indexOf(from), items.indexOf(to));
      }
      inst.layoutItems()._emitter.emit(evMoveItem, from, to, isSwap ? 'swap' : 'move');
    }

    return inst;

  };

  /**
   * Send item to another Muuri instance.
   *
   * @public
   * @memberof Muuri.prototype
   * @param {HTMLElement|Item|Number} item
   * @param {Muuri} muuri
   * @param {HTMLElement|Item|Number} [position=0]
   * @returns {Muuri} returns the Muuri instance.
   */
  Muuri.prototype.sendItem = function (item, muuri, position) {

    // TODO: Account for the release scenario. When item is released into
    // another muuri instance we need to set the element as releasing for the
    // new container also. However, what to do if drag is disabled for the
    // receiving container?

    var currentMuuri = this;
    var currentMuuriStn = currentMuuri._settings;
    var targetMuuri = muuri;
    var targetMuuriStn = targetMuuri._settings;
    var targetItem;
    var targetElement;
    var currentIndex;
    var newIndex;
    var isPositioning;
    var isVisible;
    var isShowing;
    var isHiding;
    var isDragging;
    var isReleasing;

    // Do nothing if current muuri instance is the target muuri instance.
    if (currentMuuri === targetMuuri) {
      return inst;
    }

    // Get target item.
    targetItem = inst._getItem(item);

    // If target item does not exist return immediately.
    if (!targetItem) {
      return;
    }

    // Get target item's element and state data.
    targetElement = targetItem._element;
    isPositioning = targetItem.isPositioning();
    isVisible = targetItem.isVisible();
    isShowing = targetItem.isShowing();
    isHiding = targetItem.isHiding();
    isDragging = targetItem.isDragging();
    isReleasing = targetItem.isReleasing();

    // Get current index and target index.
    currentIndex = inst._items.indexOf(targetItem);
    newIndex = typeof position === 'number' ? position : (position ? targetMuuri._items.indexOf(targetMuuri._getItem(position)) : 0);

    // Unset current item data.
    targetItem._stopLayout(true);
    currentMuuri._itemShowHandler.stop(targetItem);
    currentMuuri._itemHideHandler.stop(targetItem);
    targetItem._drag.destroy();
    targetItem._animate.destroy();
    targetItem._animateChild.destroy();
    processQueue(targetItem._visibilityQueue, true, targetItem);
    removeClass(targetElement, currentMuuriStn.itemClass);
    removeClass(targetElement, currentMuuriStn.itemVisibleClass);
    removeClass(targetElement, currentMuuriStn.itemHiddenClass);

    // Move item instance from current muuri to target muuri.
    currentMuuri._items.splice(currentIndex, 1);
    insertItemsToArray(targetMuuri._items, targetItem, newIndex);

    // Update item's muuri reference.
    targetItem._muuri = targetMuuri;

    // Add target muuri related classnames.
    addClass(targetElement, targetMuuriStn.itemClass);
    addClass(targetElement, isVisible ? targetMuuriStn.itemVisibleClass : targetMuuriStn.itemHiddenClass);

    // Move item element to correct container.
    if (element.parentNode !== targetMuuri._element) {
      targetMuuri._element.appendChild(targetElement);
      // TODO: Here we need to update the translate values also.
    }

    // Initiate item's new animation controllers.
    targetItem._animate = new Muuri.AnimateLayout(targetItem, targetElement);
    targetItem._animateChild = new Muuri.AnimateVisibility(targetItem, targetItem._child);

    // Check if default animation engine is used.
    targetItem._isDefaultAnimate = targetItem._animate instanceof Animate;
    targetItem._isDefaultChildAnimate = targetItem._animateChild instanceof Animate;

    // Refresh item's dimensions, because they might have changed with the
    // addition of the new classnames.
    targetItem._refresh();

    // Update child element's styles to reflect the current visibility state.
    if (isVisible) {
      targetMuuri._itemShowHandler.start(targetItem, true);
    }
    else {
      targetMuuri._itemHideHandler.start(inst, true);
    }

    // Update item's drag handler.
    targetItem._drag = targetMuuriStn.dragEnabled ? new Muuri.Drag(targetItem) : null;

    // Do layout for both containers.
    currentMuuri.layoutItems();
    targetMuuri.layoutItems();

    // Emit events.
    currentMuuri._emitter.emit(evSendItem, targetItem, targetMuuri, newIndex);
    targetMuuri._emitter.emit(evReceiveItem, targetItem, currentMuuri, newIndex);

    return currentMuuri;

  };

  /**
   * Destroy the instance.
   *
   * @public
   * @memberof Muuri.prototype
   */
  Muuri.prototype.destroy = function () {

    var inst = this;
    var container = inst._element;
    var items = inst._items.concat();
    var emitter = inst._emitter;
    var props = Object.keys(inst).concat(Object.keys(Muuri.prototype));
    var emitterEvents;
    var i;

    // Unbind window resize event listener.
    if (inst._resizeHandler) {
      global.removeEventListener('resize', inst._resizeHandler);
    }

    // Destroy items.
    for (i = 0; i < items.length; i++) {
      items[i]._destroy();
    }

    // Restore container.
    removeClass(container, inst._settings.containerClass);
    setStyles(container, {
      height: ''
    });

    // Emit destroy event. We need to do this before unbinding all the events
    // and nullifying the instance.
    emitter.emit(evDestroy);

    // Remove all event listeners.
    emitterEvents = Object.keys(emitter._events || {});
    for (i = 0; i < emitterEvents.length; i++) {
      emitter._events[emitterEvents[i]].length = 0;
    }

    // Render the instance unusable -> nullify all Muuri related properties.
    for (i = 0; i < props.length; i++) {
      inst[props[i]] = null;
    }

  };

  /**
   * Muuri - Protected prototype methods
   * ***********************************
   */

  /**
   * Get instance's item by element or by index. Target can also be a
   * Muuri item instance in which case the function returns the item if it
   * exists within related Muuri instance. If nothing is found with the
   * provided target null is returned.
   *
   * @protected
   * @memberof Muuri.prototype
   * @param {HTMLElement|Item|Number} [target=0]
   * @returns {?Item}
   */
  Muuri.prototype._getItem = function (target) {

    var inst = this;
    var index;
    var ret;
    var item;
    var i;

    // If no target is specified, return the first item or null.
    if (!target) {

      return inst._items[0] || null;

    }
    // If the target is instance of Item return it if it is attached to this
    // Muuri instance, otherwise return null.
    else if (target instanceof Item) {

      return target._muuri === inst ? target : null;

    }
    // If target is number return the item in that index. If the number is lower
    // than zero look for the item starting from the end of the items array. For
    // example -1 for the last item, -2 for the second last item, etc.
    else if (typeof target === 'number') {

      index = target > -1 ? target : inst._items.length + target;

      return inst._items[index] || null;

    }
    // In other cases let's assume that the target is an element, so let's try
    // to find an item that matches the element and return it. If item is not
    // found return null.
    else {

      ret = null;

      for (i = 0; i < inst._items.length; i++) {
        item = inst._items[i];
        if (item._element === target) {
          ret = item;
          break;
        }
      }

      return ret;

    }

  };

  /**
   * Item
   * ****
   */

  /**
   * Creates a new Item instance for Muuri instance.
   *
   * @public
   * @class
   * @param {Muuri} muuri
   * @param {HTMLElement} element
   */
  function Item(muuri, element) {

    var inst = this;
    var stn = muuri._settings;
    var initialStyles;
    var isHidden;

    // Make sure the item element is not a parent of the grid container element.
    // TODO: Is this necessary? Should we just let this be the user's
    // responsibility instead of enforcing it.
    if (element.contains(muuri._element)) {
      throw new Error('Item element must be within the grid container element');
    }

    // If the provided item element is not a direct child of the grid container
    // element, append it to the grid container.
    // TODO: Is this necessary? Should we just let this be the user's
    // responsibility instead of enforcing it.
    if (element.parentNode !== muuri._element) {
      muuri._element.appendChild(element);
    }

    // Set item class.
    addClass(element, stn.itemClass);

    // Check if the element is hidden.
    isHidden = getStyle(element, 'display') === 'none';

    // Set visible/hidden class.
    addClass(element, isHidden ? stn.itemHiddenClass : stn.itemVisibleClass);

    // Instance id.
    inst._id = ++uuid;
    inst._muuri = muuri;
    inst._element = element;
    inst._child = element.children[0];

    // Initiate item's animation controllers.
    inst._animate = new Muuri.AnimateLayout(inst, element);
    inst._animateChild = new Muuri.AnimateVisibility(inst, inst._child);

    // Check if default animation engine is used.
    inst._isDefaultAnimate = inst._animate instanceof Animate;
    inst._isDefaultChildAnimate = inst._animateChild instanceof Animate;

    // Set up active state (defines if the item is considered part of the layout
    // or not).
    inst._isActive = isHidden ? false : true;

    // Set up positioning state (defines if the item is currently animating
    // it's position).
    inst._isPositioning = false;

    // Set up visibility states.
    inst._isHidden = isHidden;
    inst._isHiding = false;
    inst._isShowing = false;

    // Visibility animation callback queue. Whenever a callback is provided for
    // show/hide methods and animation is enabled the callback is stored
    // temporarily to this array. The callbacks are called with the first
    // argument as false if the animation succeeded without interruptions and
    // with the first argument as true if the animation was interrupted.
    inst._visibilityQueue = [];

    // Layout animation callback queue. Whenever a callback is provided for
    // layout method and animation is enabled the callback is stored temporarily
    // to this array. The callbacks are called with the first argument as false
    // if the animation succeeded without interruptions and with the first
    // argument as true if the animation was interrupted.
    inst._layoutQueue = [];

    // Set up initial positions.
    inst._left = 0;
    inst._top = 0;

    // Define initial styles.
    initialStyles = {
      left: '0',
      top: '0',
      transform: 'translateX(0px) translateY(0px)'
    };

    // Enforce display "block" if element is visible.
    // TODO: Is this necessary? There might be cases where the user needs the
    // element to another display type and everything should work fine unless
    // the display type is not "inline" or similar.
    if (!isHidden) {
      initialStyles['display'] = 'block';
    }

    // Set element's initial styles.
    setStyles(inst._element, initialStyles);

    // Calculate and set up initial dimensions.
    inst._refresh();

    // Set initial styles for the child element.
    if (isHidden) {
      muuri._itemHideHandler.start(inst, true);
    }
    else {
      muuri._itemShowHandler.start(inst, true);
    }

    // Set up drag handler.
    inst._drag = stn.dragEnabled ? new Muuri.Drag(inst) : null;

  }

  /**
   * Item - Public prototype methods
   * *******************************
   */

  /**
   * Get the instance element.
   *
   * @public
   * @memberof Item.prototype
   * @returns {HTMLElement}
   */
  Item.prototype.getElement = function () {

    return this._element;

  };

  /**
   * Get instance element's cached width.
   *
   * @public
   * @memberof Item.prototype
   * @returns {Number}
   */
  Item.prototype.getWidth = function () {

    return this._width;

  };

  /**
   * Get instance element's cached height.
   *
   * @public
   * @memberof Item.prototype
   * @returns {Number}
   */
  Item.prototype.getHeight = function () {

    return this._height;

  };

  /**
   * Get instance element's cached margins.
   *
   * @public
   * @memberof Item.prototype
   * @returns {Object}
   *   - The returned object contains left, right, top and bottom properties
   *     which indicate the item element's cached margins.
   */
  Item.prototype.getMargin = function () {

    return {
      left: this._margin.left,
      right: this._margin.right,
      top: this._margin.top,
      bottom: this._margin.bottom
    };

  };

  /**
   * Get instance element's cached position.
   *
   * @public
   * @memberof Item.prototype
   * @returns {Object}
   *   - The returned object contains left and top properties which indicate the
   *     item element's cached position in the grid.
   */
  Item.prototype.getPosition = function () {

    return {
      left: this._left,
      top: this._top
    };

  };

  /**
   * Is the item active?
   *
   * @public
   * @memberof Item.prototype
   * @returns {Boolean}
   */
  Item.prototype.isActive = function () {

    return this._isActive;

  };

  /**
   * Is the item visible?
   *
   * @public
   * @memberof Item.prototype
   * @returns {Boolean}
   */
  Item.prototype.isVisible = function () {

    return !this._isHidden;

  };

  /**
   * Is the item being animated to visible?
   *
   * @public
   * @memberof Item.prototype
   * @returns {Boolean}
   */
  Item.prototype.isShowing = function () {

    return this._isShowing;

  };

  /**
   * Is the item being animated to hidden?
   *
   * @public
   * @memberof Item.prototype
   * @returns {Boolean}
   */
  Item.prototype.isHiding = function () {

    return this._isHiding;

  };

  /**
   * Is the item positioning?
   *
   * @public
   * @memberof Item.prototype
   * @returns {Boolean}
   */
  Item.prototype.isPositioning = function () {

    return this._isPositioning;

  };

  /**
   * Is the item being dragged?
   *
   * @public
   * @memberof Item.prototype
   * @returns {Boolean}
   */
  Item.prototype.isDragging = function () {

    return this._drag && this._drag._drag.isActive;

  };

  /**
   * Is the item being released?
   *
   * @public
   * @memberof Item.prototype
   * @returns {Boolean}
   */
  Item.prototype.isReleasing = function () {

    return this._drag && this._drag._release.isActive;

  };

  /**
   * Item - Protected prototype methods
   * **********************************
   */

  /**
   * Stop item's position animation if it is currently animating.
   *
   * @protected
   * @memberof Item.prototype
   * @param {Boolean} [processLayoutQueue=false]
   * @returns {Item} returns the Item instance.
   */
  Item.prototype._stopLayout = function (processLayoutQueue) {

    var inst = this;
    var stn = inst._muuri._settings;

    if (inst._isPositioning) {

      // Stop animation.
      inst._animate.stop();

      // Remove positioning class.
      removeClass(inst._element, stn.itemPositioningClass);

      // Reset state.
      inst._isPositioning = false;

      // Process callback queue.
      if (processLayoutQueue) {
        processQueue(inst._layoutQueue, true, inst);
      }

    }

    return inst;

  };

  /**
   * Recalculate item's dimensions.
   *
   * @protected
   * @memberof Item.prototype
   * @returns {Item} returns the Item instance.
   */
  Item.prototype._refresh = function () {

    var inst = this;
    var element = inst._element;
    var rect;
    var sides;
    var side;
    var margin;
    var i;

    if (!inst._isHidden) {

      // Calculate margins (ignore negative margins).
      sides = ['left', 'right', 'top', 'bottom'];
      margin = inst._margin = inst._margin || {};
      for (i = 0; i < 4; i++) {
        side = Math.round(getStyleAsFloat(element, 'margin-' + sides[i]));
        margin[sides[i]] = side > 0 ? side : 0;
      }

      // Calculate width and height (including margins).
      rect = element.getBoundingClientRect();
      inst._width = Math.round(rect.width);
      inst._height = Math.round(rect.height);
      inst._outerWidth = inst._width + margin.left + margin.right;
      inst._outerHeight = inst._height + margin.top + margin.bottom;

    }

    return inst;

  };

  /**
   * Position item based on it's current data.
   *
   * @protected
   * @memberof Item.prototype
   * @param {Boolean} instant
   * @param {Function} [callback]
   * @returns {Item} returns the Item instance.
   */
  Item.prototype._layout = function (instant, callback) {

    var inst = this;
    var stn = inst._muuri._settings;
    var release = inst._drag ? inst._drag._release : {};
    var isJustReleased = release.isActive && release.isPositioningStarted === false;
    var animDuration = isJustReleased ? stn.dragReleaseDuration : stn.layoutDuration;
    var animEasing = isJustReleased ? stn.dragReleaseEasing : stn.layoutEasing;
    var animEnabled = instant === true || inst._noLayoutAnimation ? false : animDuration > 0;
    var isPositioning = inst._isPositioning;
    var offsetLeft;
    var offsetTop;
    var currentLeft;
    var currentTop;
    var finish = function () {

      // Mark the item as not positioning and remove positioning classes.
      if (inst._isPositioning) {
        inst._isPositioning = false;
        removeClass(inst._element, stn.itemPositioningClass);
      }

      // Finish up release.
      if (release.isActive) {
        inst._drag._endRelease();
      }

      // Process the callback queue.
      processQueue(inst._layoutQueue, false, inst);

    };

    // Process current layout callback queue with interrupted flag on if the
    // item is currently positioning.
    if (isPositioning) {
      processQueue(inst._layoutQueue, true, inst);
    }

    // Mark release positioning as started.
    if (isJustReleased) {
      release.isPositioningStarted = true;
    }

    // Push the callback to the callback queue.
    if (typeof callback === 'function') {
      inst._layoutQueue[inst._layoutQueue.length] = callback;
    }

    // Get item container offset. This applies only for release handling in the
    // scenario where the released element is not currently within the muuri
    // container.
    offsetLeft = release.isActive ? release.containerDiffX : 0;
    offsetTop = release.isActive ? release.containerDiffY : 0;

    // If no animations are needed, easy peasy!
    if (!animEnabled) {

      inst._stopLayout();
      inst._noLayoutAnimation = false;

      // Set the styles only if they are not set later on. If an item is being
      // released after drag and the drag container is something else than the
      // Muuri container these styles will be set after the item has been
      // moved back to the Muuri container, which also means that setting the
      // styles here in that scenario is a waste of resources.
      if (!(release.isActive && release.element.parentNode !== inst._muuri._element)) {
        setStyles(inst._element, {
          transform: 'translateX(' + (inst._left + offsetLeft) + 'px) translateY(' + (inst._top + offsetTop) + 'px)'
        });
      }

      finish();

    }

    // If animations are needed, let's dive in.
    else {

      // Get current (relative) left and top position. Meaning that the
      // container's offset (if applicable) is subtracted from the current
      // translate values.
      if (isPositioning && inst._isDefaultAnimate) {
        currentLeft = parseFloat(Velocity.hook(inst._element, 'translateX')) - offsetLeft;
        currentTop = parseFloat(Velocity.hook(inst._element, 'translateY')) - offsetTop;
      }
      else {
        currentLeft = getTranslateAsFloat(inst._element, 'x') - offsetLeft;
        currentTop = getTranslateAsFloat(inst._element, 'y') - offsetTop;
      }

      // If the item is already in correct position there's no need to animate
      // it.
      if (inst._left === currentLeft && inst._top === currentTop) {
        inst._stopLayout();
        finish();
        return;
      }

      // Mark as positioning and add positioning class if necessary.
      if (!isPositioning) {
        inst._isPositioning = true;
        addClass(inst._element, stn.itemPositioningClass);
      }

      // Animate.
      inst._animate.start({
        translateX: (release.isActive ? currentLeft + offsetLeft : currentLeft) + 'px',
        translateY: (release.isActive ? currentTop + offsetTop : currentTop) + 'px'
      }, {
        translateX: inst._left + offsetLeft,
        translateY: inst._top + offsetTop
      }, {
        duration: animDuration,
        easing: animEasing,
        done: finish
      });

    }

    return inst;

  };

  /**
   * Show item.
   *
   * @protected
   * @memberof Item.prototype
   * @param {Boolean} instant
   * @param {Function} [callback]
   * @returns {Item} returns the Item instance.
   */
  Item.prototype._show = function (instant, callback) {

    var inst = this;
    var stn = inst._muuri._settings;

    // If item is visible.
    if (!inst._isHidden && !inst._isShowing) {

      // Call the callback and be done with it.
      if (typeof callback === 'function') {
        callback(false, inst);
      }

    }

    // If item is animating to visible.
    else if (!inst._isHidden) {

      // Push the callback to callback queue.
      if (typeof callback === 'function') {
        inst._visibilityQueue[inst._visibilityQueue.length] = callback;
      }

    }

    // If item is hidden or animating to hidden.
    else {

      // Stop ongoing hide animation.
      if (inst._isHiding) {
        inst._muuri._itemHideHandler.stop(inst);
      }

      // Activate item and set showing state to true.
      inst._isActive = inst._isShowing = true;

      // Set hidden and hiding states to false.
      inst._isHidden = inst._isHiding = false;

      // Update item classes.
      addClass(inst._element, stn.itemVisibleClass);
      removeClass(inst._element, stn.itemHiddenClass);

      // Set item element's display style to block.
      setStyles(inst._element, {
        display: 'block'
      });

      // Process the visibility callback queue with the interrupted flag active.
      processQueue(inst._visibilityQueue, true, inst);

      // Push the callback to the visibility callback queue.
      if (typeof callback === 'function') {
        inst._visibilityQueue[inst._visibilityQueue.length] = callback;
      }

      // Animate child element and process the visibility callback queue after
      // succesful animation.
      inst._muuri._itemShowHandler.start(inst, instant, function () {
        processQueue(inst._visibilityQueue, false, inst);
      });

    }

    return inst;

  };

  /**
   * Hide item.
   *
   * @protected
   * @memberof Item.prototype
   * @param {Boolean} instant
   * @param {Function} [callback]
   * @returns {Item} returns the Item instance.
   */
  Item.prototype._hide = function (instant, callback) {

    var inst = this;
    var stn = inst._muuri._settings;

    // If item is hidden.
    if (inst._isHidden && !inst._isHiding) {

      // Call the callback and be done with it.
      if (typeof callback === 'function') {
        callback(false, inst);
      }

    }

    // If item is animating to hidden.
    else if (inst._isHidden) {

      // Push the callback to callback queue.
      if (typeof callback === 'function') {
        inst._visibilityQueue[inst._visibilityQueue.length] = callback;
      }

    }

    // If item is visible or animating to visible.
    else {

      // Stop ongoing show animation.
      if (inst._isShowing) {
        inst._muuri._itemShowHandler.stop(inst);
      }

      // Set hidden and hiding states to true.
      inst._isHidden = inst._isHiding = true;

      // Disable item and set showing to false.
      inst._isActive = inst._isShowing = false;

      // Update item classes.
      addClass(inst._element, stn.itemHiddenClass);
      removeClass(inst._element, stn.itemVisibleClass);

      // Process the visibility callback queue with the interrupted flag active.
      processQueue(inst._visibilityQueue, true, inst);

      // Push the callback to the visibility callback queue.
      if (typeof callback === 'function') {
        inst._visibilityQueue[inst._visibilityQueue.length] = callback;
      }

      // Animate child element.
      inst._muuri._itemHideHandler.start(inst, instant, function () {

        // Hide element.
        setStyles(inst._element, {
          display: 'none'
        });

        // Process callback queue.
        processQueue(inst._visibilityQueue, false, inst);

      });

    }

    return inst;

  };

  /**
   * Destroy item instance.
   *
   * @protected
   * @memberof Item.prototype
   * @param {Boolean} [removeElement=false]
   */
  Item.prototype._destroy = function (removeElement) {

    var inst = this;
    var muuri = inst._muuri;
    var stn = muuri._settings;
    var element = inst._element;
    var index = muuri._items.indexOf(inst);
    var props = Object.keys(inst).concat(Object.keys(Item.prototype));
    var i;

    // Stop animations.
    inst._stopLayout(true);
    muuri._itemShowHandler.stop(inst);
    muuri._itemHideHandler.stop(inst);

    // If item is being dragged or released, stop it gracefully.
    if (inst._drag) {
      inst._drag.destroy();
    }

    // Destroy animation handlers.
    inst._animate.destroy();
    inst._animateChild.destroy();

    // Remove all inline styles.
    element.removeAttribute('style');
    inst._child.removeAttribute('style');

    // Handle visibility callback queue, fire all uncompleted callbacks with
    // interrupted flag.
    processQueue(inst._visibilityQueue, true, inst);

    // Remove Muuri specific classes.
    removeClass(element, stn.itemPositioningClass);
    removeClass(element, stn.itemDraggingClass);
    removeClass(element, stn.itemReleasingClass);
    removeClass(element, stn.itemClass);
    removeClass(element, stn.itemVisibleClass);
    removeClass(element, stn.itemHiddenClass);

    // Remove item from Muuri instance if it still exists there.
    if (index > -1) {
      muuri._items.splice(index, 1);
    }

    // Remove element from DOM.
    if (removeElement) {
      element.parentNode.removeChild(element);
    }

    // Nullify all properties.
    for (i = 0; i < props.length; i++) {
      inst[props[i]] = null;
    }

  };

  /**
   * Layout
   * ******
   */

  /**
   * Creates a new Muuri Layout instance.
   *
   * @public
   * @class
   * @param {Muuri} muuri
   * @param {Item[]} [items]
   */
  function Layout(muuri, items) {

    var inst = this;
    var stn = muuri._settings.layout;
    var padding = muuri._padding;
    var border = muuri._border;

    inst.muuri = muuri;
    inst.items = items ? items.concat() : muuri.getItems('active');
    inst.slots = {};
    inst.setWidth = false;
    inst.setHeight = false;

    // Calculate the current width and height of the container.
    inst.width = muuri._width - border.left - border.right - padding.left - padding.right;
    inst.height = muuri._height - border.top - border.bottom - padding.top - padding.bottom;

    // If the user has provided custom function as a layout method invoke it.
    if (typeof stn === 'function') {
      stn(inst);
    }

    // Otherwise invoke the default layout method.
    else {
      layoutFirstFit(inst, isPlainObject(stn) ? stn : {});
    }

  }

  /**
   * Layout - Default layout method
   * ******************************
   */

  /**
   * LayoutFirstFit v0.3.0-dev
   * Copyright (c) 2016 Niklas Rämö <inramo@gmail.com>
   * Released under the MIT license
   *
   * The default Muuri layout method.
   *
   * @private
   * @param {Layout} layout
   * @param {Object} settings
   * @param {Boolean} [settings.fillGaps=false]
   * @param {Boolean} [settings.horizontal=false]
   * @param {Boolean} [settings.alignRight=false]
   * @param {Boolean} [settings.alignBottom=false]
   */
  function layoutFirstFit(layout, settings) {

    var slotIds;
    var slot;
    var item;
    var i;

    // Empty slots data.
    var emptySlots = [];

    // Normalize settings.
    var fillGaps = settings.fillGaps ? true : false;
    var isHorizontal = settings.horizontal ? true : false;
    var alignRight = settings.alignRight ? true : false;
    var alignBottom = settings.alignBottom ? true : false;

    // Set horizontal/vertical mode.
    if (isHorizontal) {
      layout.setWidth = true;
      layout.width = 0;
    }
    else {
      layout.setHeight = true;
      layout.height = 0;
    }

    // No need to go further if items do not exist.
    if (!layout.items.length) {
      return;
    }

    // Find slots for items.
    for (i = 0; i < layout.items.length; i++) {

      item = layout.items[i];
      slot = layoutFirstFit.getSlot(layout, emptySlots, item._outerWidth, item._outerHeight, !isHorizontal, fillGaps);

      // Update layout width/height.
      if (isHorizontal) {
        layout.width = Math.max(layout.width, slot.left + slot.width);
      }
      else {
        layout.height = Math.max(layout.height, slot.top + slot.height);
      }

      // Add slot to slots data.
      layout.slots[item._id] = slot;

    }

    // If the alignment is set to right or bottom, we need to adjust the
    // results.
    if (alignRight || alignBottom) {

      slotIds = Object.keys(layout.slots);

      for (i = 0; i < slotIds.length; i++) {

        slot = layout.slots[slotIds[i]];

        if (alignRight) {
          slot.left = layout.width - (slot.left + slot.width);
        }

        if (alignBottom) {
          slot.top = layout.height - (slot.top + slot.height);
        }

      }

    }

  }

  /**
   * Calculate position for the layout item. Returns the left and top position
   * of the item in pixels.
   *
   * @private
   * @memberof layoutFirstFit
   * @param {Layout} layout
   * @param {Array} slots
   * @param {Number} itemWidth
   * @param {Number} itemHeight
   * @param {Boolean} vertical
   * @param {Boolean} fillGaps
   * @returns {Object}
   */
  layoutFirstFit.getSlot = function (layout, slots, itemWidth, itemHeight, vertical, fillGaps) {

    var currentSlots = slots[0] || [];
    var newSlots = [];
    var item = {
      left: null,
      top: null,
      width: itemWidth,
      height: itemHeight
    };
    var slot;
    var potentialSlots;
    var ignoreCurrentSlots;
    var i;
    var ii;

    // Try to find a slot for the item.
    for (i = 0; i < currentSlots.length; i++) {
      slot = currentSlots[i];
      if (item.width <= slot.width && item.height <= slot.height) {
        item.left = slot.left;
        item.top = slot.top;
        break;
      }
    }

    // If no slot was found for the item.
    if (item.left === null) {

      // Position the item in to the bottom left (vertical mode) or top right
      // (horizontal mode) of the grid.
      item.left = vertical ? 0 : layout.width;
      item.top = vertical ? layout.height : 0;

      // If gaps don't needs filling do not add any current slots to the new
      // slots array.
      if (!fillGaps) {
        ignoreCurrentSlots = true;
      }

    }

    // In vertical mode, if the item's bottom overlaps the grid's bottom.
    if (vertical && (item.top + item.height) > layout.height) {

      // If item is not aligned to the left edge, create a new slot.
      if (item.left > 0) {
        newSlots[newSlots.length] = {
          left: 0,
          top: layout.height,
          width: item.left,
          height: Infinity
        };
      }

      // If item is not aligned to the right edge, create a new slot.
      if ((item.left + item.width) < layout.width) {
        newSlots[newSlots.length] = {
          left: item.left + item.width,
          top: layout.height,
          width: layout.width - item.left - item.width,
          height: Infinity
        };
      }

      // Update grid height.
      layout.height = item.top + item.height;

    }

    // In horizontal mode, if the item's right overlaps the grid's right edge.
    if (!vertical && (item.left + item.width) > layout.width) {

      // If item is not aligned to the top, create a new slot.
      if (item.top > 0) {
        newSlots[newSlots.length] = {
          left: layout.width,
          top: 0,
          width: Infinity,
          height: item.top
        };
      }

      // If item is not aligned to the bottom, create a new slot.
      if ((item.top + item.height) < layout.height) {
        newSlots[newSlots.length] = {
          left: layout.width,
          top: item.top + item.height,
          width: Infinity,
          height: layout.height - item.top - item.height
        };
      }

      // Update grid width.
      layout.width = item.left + item.width;

    }

    // Clean up the current slots making sure there are no old slots that
    // overlap with the item. If an old slot overlaps with the item, split it
    // into smaller slots if necessary.
    for (i = fillGaps ? 0 : ignoreCurrentSlots ? currentSlots.length : i; i < currentSlots.length; i++) {
      potentialSlots = layoutFirstFit.splitRect(currentSlots[i], item);
      for (ii = 0; ii < potentialSlots.length; ii++) {
        slot = potentialSlots[ii];
        if (slot.width > 0 && slot.height > 0 && ((vertical && slot.top < layout.height) || (!vertical && slot.left < layout.width))) {
          newSlots[newSlots.length] = slot;
        }
      }
    }

    // Remove redundant slots and sort the new slots.
    layoutFirstFit.purgeSlots(newSlots).sort(vertical ? layoutFirstFit.sortRectsTopLeft : layoutFirstFit.sortRectsLeftTop);

    // Update the slots data.
    slots[0] = newSlots;

    // Return the item.
    return item;

  };

  /**
   * Sort rectangles with top-left gravity. Assumes that objects with
   * properties left, top, width and height are being sorted.
   *
   * @private
   * @memberof layoutFirstFit
   * @param {Object} a
   * @param {Object} b
   * @returns {Number}
   */
  layoutFirstFit.sortRectsTopLeft = function (a, b) {

    return a.top < b.top ? -1 : (a.top > b.top ? 1 : (a.left < b.left ? -1 : (a.left > b.left ? 1 : 0)));

  };

  /**
   * Sort rectangles with left-top gravity. Assumes that objects with
   * properties left, top, width and height are being sorted.
   *
   * @private
   * @memberof layoutFirstFit
   * @param {Object} a
   * @param {Object} b
   * @returns {Number}
   */
  layoutFirstFit.sortRectsLeftTop = function (a, b) {

    return a.left < b.left ? -1 : (a.left > b.left ? 1 : (a.top < b.top ? -1 : (a.top > b.top ? 1 : 0)));

  };

  /**
   * Check if a rectabgle is fully within another rectangle. Assumes that the
   * rectangle object has the following properties: left, top, width and height.
   *
   * @private
   * @memberof layoutFirstFit
   * @param {Object} a
   * @param {Object} b
   * @returns {Boolean}
   */
  layoutFirstFit.isRectWithinRect = function (a, b) {

    return a.left >= b.left && a.top >= b.top && (a.left + a.width) <= (b.left + b.width) && (a.top + a.height) <= (b.top + b.height);

  };

  /**
   * Loops through an array of slots and removes all slots that are fully within
   * another slot in the array.
   *
   * @private
   * @memberof layoutFirstFit
   * @param {Array} slots
   */
  layoutFirstFit.purgeSlots = function (slots) {

    var i = slots.length;
    var ii;
    var slotA;
    var slotB;

    while (i--) {
      slotA = slots[i];
      ii = slots.length;
      while (ii--) {
        slotB = slots[ii];
        if (i !== ii && layoutFirstFit.isRectWithinRect(slotA, slotB)) {
          slots.splice(i, 1);
          break;
        }
      }
    }

    return slots;

  };

  /**
   * Compares a rectangle to another and splits it to smaller pieces (the parts
   * that exceed the other rectangles edges). At maximum generates four smaller
   * rectangles.
   *
   * @private
   * @memberof layoutFirstFit
   * @param {Object} a
   * @param {Object} b
   * returns {Array}
   */
  layoutFirstFit.splitRect = function (a, b) {

    var ret = [];
    var overlap = !(b.left > (a.left + a.width) || (b.left + b.width) < a.left || b.top > (a.top + a.height) || (b.top + b.height) < a.top);

    // If rect a does not overlap with rect b add rect a to the return data as
    // is.
    if (!overlap) {

      ret[0] = a;

    }
    // If rect a overlaps with rect b split rect a into smaller rectangles and
    // add them to the return data.
    else {

      // Left split.
      if (a.left < b.left) {
        ret[ret.length] = {
          left: a.left,
          top: a.top,
          width: b.left - a.left,
          height: a.height
        };
      }

      // Right split.
      if ((a.left + a.width) > (b.left + b.width)) {
        ret[ret.length] = {
          left: b.left + b.width,
          top: a.top,
          width: (a.left + a.width) - (b.left + b.width),
          height: a.height
        };
      }

      // Top split.
      if (a.top < b.top) {
        ret[ret.length] = {
          left: a.left,
          top: a.top,
          width: a.width,
          height: b.top - a.top
        };
      }

      // Bottom split.
      if ((a.top + a.height) > (b.top + b.height)) {
        ret[ret.length] = {
          left: a.left,
          top: b.top + b.height,
          width: a.width,
          height: (a.top + a.height) - (b.top + b.height)
        };
      }

    }

    return ret;

  };

  /**
   * Emitter
   * *******
   */

  /**
   * Event emitter constructor.
   *
   * This is a simplified version of jvent.js event emitter library:
   * https://github.com/pazguille/jvent/blob/0.2.0/dist/jvent.js
   *
   * @public
   * @class
   */
  function Emitter() {}

  /**
   * Emitter - Public prototype methods
   * **********************************
   */

  /**
   * Bind an event listener.
   *
   * @public
   * @memberof Emitter.prototype
   * @param {String} event
   * @param {Function} listener
   * @returns {Emitter} returns the Emitter instance.
   */
  Emitter.prototype.on = function (event, listener) {

    var events = this._events = this._events || {};
    var listeners = events[event] || [];

    listeners[listeners.length] = listener;
    events[event] = listeners;

    return this;

  };

  /**
   * Unbind all event listeners that match the provided listener function.
   *
   * @public
   * @memberof Emitter.prototype
   * @param {String} event
   * @param {Function} listener
   * @returns {Emitter} returns the Emitter instance.
   */
  Emitter.prototype.off = function (event, listener) {

    var events = this._events = this._events || {};
    var listeners = events[event] || [];
    var counter = listeners.length;

    if (counter) {
      while (counter--) {
        if (listener === listeners[i]) {
          listeners.splice(counter, 1);
        }
      }
    }

    return this;

  };

  /**
   * Emit all listeners in a specified event with the provided arguments.
   *
   * @public
   * @memberof Emitter.prototype
   * @param {String} event
   * @param {*} [arg1]
   * @param {*} [arg2]
   * @param {*} [arg3]
   * @returns {Emitter} returns the Emitter instance.
   */
  Emitter.prototype.emit = function (event, arg1, arg2, arg3) {

    var events = this._events = this._events || {};
    var listeners = events[event] || [];
    var listenersLength = listeners.length;
    var argsLength;
    var i;

    if (listenersLength) {

      argsLength = arguments.length - 1;
      listeners = listeners.concat();

      for (i = 0; i < listenersLength; i++) {
        argsLength === 0 ? listeners[i]() :
        argsLength === 1 ? listeners[i](arg1) :
        argsLength === 2 ? listeners[i](arg1, arg2) :
                           listeners[i](arg1, arg2, arg3);
      }

    }

    return this;

  };

  /**
   * Animate
   * *******
   */

  /**
   * Muuri's internal animation engine. Uses Velocity.
   *
   * @public
   * @class
   * @param {Item} item
   * @param {HTMLElement} element
   */
  function Animate(item, element) {

    this._element = element;
    this._queue = libName + '-' + (++uuid);
    this._isAnimating = false;

  }

  /**
   * Animate - Public prototype methods
   * **********************************
   */

  /**
   * Start instance's animation. Automatically stops current animation if it is
   * running.
   *
   * @public
   * @memberof Animate.prototype
   * @param {?Object} propsCurrent
   * @param {Object} propsTarget
   * @param {Object} [options]
   * @param {Number} [options.duration=300]
   * @param {Number} [options.delay=0]
   * @param {String} [options.easing='ease']
   */
  Animate.prototype.start = function (propsCurrent, propsTarget, options) {

    var inst = this;
    var opts = options || {};
    var callback = typeof opts.done === 'function' ? opts.done : null;
    var velocityOpts = {
      duration: opts.duration || 300,
      delay: opts.delay || 0,
      easing: opts.easing || 'ease',
      queue: inst._queue
    };

    // Stop current animation, if running.
    if (inst._isAnimating) {
      inst.stop();
    }

    // Otherwise if current props exist force feed current values to Velocity.
    if (propsCurrent) {
      hookStyles(inst._element, propsCurrent);
    }

    // Set as animating.
    inst._isAnimating = true;

    // Add callback if it exists.
    if (callback) {
      velocityOpts.complete = function () {
        callback();
      }
    }

    // Set up and start the animation.
    Velocity(inst._element, propsTarget, velocityOpts);
    Velocity.Utilities.dequeue(inst._element, inst._queue);

  };

  /**
   * Stop instance's current animation if running.
   *
   * @public
   * @memberof Animate.prototype
   */
  Animate.prototype.stop = function () {

    if (this._isAnimating) {
      this._isAnimating = false;
      Velocity(this._element, 'stop', this._queue);
    }

  };

  /**
   * Destroy the instance and stop current animation if it is running.
   *
   * @public
   * @memberof Animate.prototype
   * @returns {Boolean}
   */
  Animate.prototype.destroy = function () {

    // Stop current animation.
    this.stop();

    // Nullify props.
    this._element = null;
    this._isAnimating = null;
    this._queue = null;

  };

  /**
   * Drag
   * ****
   */

  /**
   * Bind Hammer touch interaction to an item.
   *
   * @class
   * @private
   * @param {Item} item
   */
  function Drag(item) {

    // Check that we have Hammer.
    if (!Hammer) {
      throw Error('[' + libName + '] required dependency Hammer is not defined.');
    }

    var inst = this;
    var stn = item._muuri._settings;
    var checkPredicate = typeof stn.dragStartPredicate === 'function' ? stn.dragStartPredicate : Drag.defaultStartPredicate;
    var predicate = null;
    var predicateEvent = null;
    var hammer;

    inst._item = item;
    inst._hammer = hammer = new Hammer.Manager(item._element);

    // Setup item's drag data.
    inst._setupDragData();

    // Setup item's release data.
    inst._setupReleaseData();

    // Setup overlap checker function.
    inst._checkSortOverlap = debounce(function () {
      if (inst._drag.isActive) {
        inst._checkOverlap();
      }
    }, stn.dragSortInterval);

    // Setup sort predicate.
    inst._sortPredicate = typeof stn.dragSortPredicate === 'function' ? stn.dragSortPredicate : Drag.defaultSortPredicate;

    // Setup drag scroll handler.
    inst._scrollHandler = function (e) {
      inst._onDragScroll(e);
    };

    // Add drag recognizer to hammer.
    hammer.add(new Hammer.Pan({
      event: 'drag',
      pointers: 1,
      threshold: 0,
      direction: Hammer.DIRECTION_ALL
    }));

    // Add draginit recognizer to hammer.
    hammer.add(new Hammer.Press({
      event: 'draginit',
      pointers: 1,
      threshold: 1000,
      time: 0
    }));

    // This is not ideal, but saves us from a LOT of hacks. Let's try to keep
    // the default drag setup consistent across devices.
    hammer.set({touchAction: 'none'});

    // Bind drag events.
    hammer
    .on('draginit dragstart dragmove', function (e) {

      // Always update the predicate event.
      predicateEvent = e;

      // Create predicate if it does not exist yet.
      if (!predicate) {
        predicate = new Predicate(function () {
          if (predicate === this) {
            inst._onDragStart(predicateEvent);
          }
        });
      }

      // If predicate is resolved and dragging is active, do the move.
      if (predicate._isResolved && inst._drag.isActive) {
        inst._onDragMove(e);
      }

      // Otherwise, check the predicate.
      else if (!predicate._isRejected && !predicate._isResolved) {
        checkPredicate.call(item._muuri, item, e, predicate);
      }

    })
    .on('dragend dragcancel draginitup', function (e) {

      // If predicate is resolved and dragging is active, do the end.
      if (predicate._isResolved && inst._drag.isActive) {
        inst._onDragEnd(e);
      }

      // Do final predicate check to allow unbinding stuff for the current drag
      // procedure within the predicate callback.
      checkPredicate.call(item._muuri, item, e, predicate);

      // Nullify predicate reference.
      predicate.reject();
      predicate = null;
      predicateEvent = null;

    });

    // Prevent native link/image dragging for the item and ite's child element.
    // Consider providing a public interface for this so the user can call this
    // method for all descendant elements.
    disableNativeDrag(item._element);
    disableNativeDrag(item._child);

  }

  /**
   * Drag - Public methods
   * *********************
   */

  /**
   * Default drag start predicate handler.
   *
   * @public
   * @memberof Drag
   * @param {Item} item
   *   - Related Muuri.Item instance.
   * @param {Object} event
   *   - Hammer event object.
   * @param {Predicate} predicate
   *   - Predicate instance.
   */
  Drag.defaultStartPredicate = function (item, event, predicate) {

    predicate.resolve();

  };

  /**
   * Default drag sort predicate.
   *
   * @public
   * @memberof Drag
   * @param {Item} targetItem
   */
  Drag.defaultSortPredicate = function (targetItem) {

    var muuri = targetItem._muuri;
    var stn = muuri._settings;
    var config = stn.dragSortPredicate || {};
    var threshold = config.threshold || 50;
    var action = config.action || 'move';
    var items = muuri._items;
    var drag = targetItem._drag;
    var instData = {
      width: drag._item._width,
      height: drag._item._height,
      left: Math.round(drag._drag.gridX) + drag._item._margin.left,
      top: Math.round(drag._drag.gridY) + drag._item._margin.top
    };
    var targetIndex = 0;
    var bestMatchScore = null;
    var bestMatchIndex;
    var overlapScore;
    var item;
    var i;

    // Find best match (the element with most overlap).
    for (i = 0; i < items.length; i++) {

      item = items[i];

      // If the item is the dragged item, save it's index.
      if (item === targetItem) {
        targetIndex = i;
      }

      // Otherwise, if the item is active.
      else if (item._isActive) {

        // Get marginless overlap data.
        overlapScore = getOverlapScore(instData, {
          width: item._width,
          height: item._height,
          left: Math.round(item._left) + item._margin.left,
          top: Math.round(item._top) + item._margin.top
        });

        // Update best match if the overlap score is higher than the current
        // best match.
        if (bestMatchScore === null || overlapScore > bestMatchScore) {
          bestMatchScore = overlapScore;
          bestMatchIndex = i;
        }

      }

    }

    // Check if the best match overlaps enough to justify a placement switch.
    if (bestMatchScore !== null && bestMatchScore >= threshold) {

      return {
        action: action,
        from: targetIndex,
        to: bestMatchIndex
      };

    }

    return false;

  };

  /**
   * Drag - Public prototype methods
   * *******************************
   */

  /**
   * Destroy instance.
   *
   * @public
   * @memberof Drag.prototype
   */
  Drag.prototype.destroy = function () {

    var inst = this;
    var item = inst._item;
    var muuri = item._muuri;
    var drag = inst._drag;
    var release = inst._release;

    // Append item element to the muuri container if it's not it's child.
    if (release.isActive || drag.isActive) {
      if (item._element.parentNode !== muuri._element) {
        muuri._element.appendChild(item._element);
      }
    }

    inst._setupReleaseData();
    inst._resetDrag();

    enableNativeDrag(item._element);
    enableNativeDrag(item._child);

    return inst;

  };

  /**
   * Drag - Protected prototype methods
   * **********************************
   */

  /**
   * Setup/reset drag data.
   *
   * @protected
   * @memberof Drag.prototype
   */
  Drag.prototype._setupDragData = function () {

    // Create drag data object if it does not exist yet.
    var drag = this._drag = this._drag || {};

    // Is item being dragged?
    drag.isActive = false;

    // Hammer event data.
    drag.startEvent = null;
    drag.currentEvent = null;

    // Dragged element's inline styles stored for graceful teardown.
    drag.elementStyles = null;

    // Scroll parents of the dragged element and muuri container.
    drag.scrollParents = [];

    // The current translateX/translateY position.
    drag.left = 0;
    drag.top = 0;

    // Dragged element's current position within the grid.
    drag.gridX = 0;
    drag.gridY = 0;

    // Dragged element's current offset from window's northwest corner. Does
    // not account for element's margins.
    drag.elementClientX = 0;
    drag.elementClientY = 0;

    // Offset difference between the dragged element's temporary drag
    // container and it's original container.
    drag.containerDiffX = 0;
    drag.containerDiffY = 0;

    return drag;

  };

  /**
   * Setup/reset release data.
   *
   * @protected
   * @memberof Drag.prototype
   */
  Drag.prototype._setupReleaseData = function () {

    // Create drag data object if it does not exist yet.
    var release = this._release = this._release || {};

    release.isActive = false;
    release.isPositioningStarted = false;
    release.containerDiffX = 0;
    release.containerDiffY = 0;
    release.element = null;
    release.elementStyles = null;

    return release;

  };

  /**
   * Check (during drag) if an item is overlapping other items and based on
   * the configuration do a relayout.
   *
   * @protected
   * @memberof Drag.prototype
   */
  Drag.prototype._checkOverlap = function () {

    var inst = this;
    var result = inst._sortPredicate(inst._item);

    if (result) {
      inst._item._muuri.moveItem(result.from, result.to, result.action || 'move');
    }

  };

  /**
   * Freeze dragged element's dimensions.
   *
   * @protected
   * @memberof Drag.prototype
   * @param {Object} data
   */
  Drag.prototype._freezeElement = function (data) {

    var styleNames;
    var styleName;
    var i;

    // Don't override existing element styles.
    if (!data.elementStyles) {

      styleNames = ['width', 'height', 'padding', 'margin'];

      // Reset element styles.
      data.elementStyles = {};

      for (i = 0; i < 4; i++) {

        styleName = styleNames[i];

        // Store current inline style values.
        data.elementStyles[styleName] = data.element.style[styleName] || '';

        // Set effective values as inline styles.
        data.element.style[styleName] = getStyle(data.element, styleName);

      }

    }

  };

  /**
   * Unfreeze dragged element's dimensions.
   *
   * @protected
   * @memberof Drag.prototype
   * @param {Object} data
   */
  Drag.prototype._unfreezeElement = function (data) {

    var styleNames;
    var styleName;
    var i;

    if (data.elementStyles) {
      styleNames = Object.keys(data.elementStyles);
      for (i = 0; i < styleNames.length; i++) {
        styleName = styleNames[i];
        data.element.style[styleName] = data.elementStyles[styleName];
      }
      data.elementStyles = null;
    }

  };

  /**
   * Reset drag data and cancel any ongoing drag activity.
   *
   * @protected
   * @memberof Drag.prototype
   */
  Drag.prototype._resetDrag = function () {

    var inst = this;
    var item = inst._item;
    var drag = inst._drag;
    var stn = item._muuri._settings;
    var i;

    if (drag.isActive) {

      // Remove scroll listeners.
      for (i = 0; i < drag.scrollParents.length; i++) {
        drag.scrollParents[i].removeEventListener('scroll', inst._scrollHandler);
      }

      // Cancel overlap check.
      inst._checkSortOverlap('cancel');

      // Remove draggin class.
      removeClass(drag.element, stn.itemDraggingClass);

      // Remove dragged element's inline styles.
      inst._unfreezeElement(drag);

      // Reset drag data.
      inst._setupDragData();

    }

  };

  /**
   * Start the release process of an item.
   *
   * @protected
   * @memberof Drag.prototype
   */
  Drag.prototype._startRelease = function () {

    var inst = this;
    var item = inst._item;
    var muuri = item._muuri;
    var stn = muuri._settings;
    var release = inst._release;

    // Flag release as active.
    release.isActive = true;

    // Add release classname to released element.
    addClass(release.element, stn.itemReleasingClass);

    // Emit releasestart event.
    muuri._emitter.emit(evReleaseItemStart, item);

    // Position the released item.
    item._layout(false);

  };

  /**
   * End the release process of an item.
   *
   * @protected
   * @memberof Drag.prototype
   */
  Drag.prototype._endRelease = function () {

    var inst = this;
    var item = inst._item;
    var muuri = item._muuri;
    var stn = muuri._settings;
    var release = inst._release;

    // Remove release classname from the released element.
    removeClass(release.element, stn.itemReleasingClass);

    // If the released element is outside the muuri container put it back there
    // and adjust position accordingly.
    if (release.element.parentNode !== muuri._element) {
      muuri._element.appendChild(release.element);
      setStyles(item._element, {
        transform: 'translateX(' + item._left + 'px) translateY(' + item._top + 'px)'
      });
    }

    // Unlock temporary inlined styles.
    inst._unfreezeElement(release);

    // Reset release data.
    inst._setupReleaseData();

    // Emit releaseend event.
    muuri._emitter.emit(evReleaseItemEnd, item);

  };

  /**
   * Drag start handler.
   *
   * @protected
   * @memberof Drag.prototype
   */
  Drag.prototype._onDragStart = function (e) {

    var inst = this;
    var item = inst._item;
    var muuri = item._muuri;
    var stn = muuri._settings;
    var drag = inst._drag;
    var release = inst._release;
    var currentLeft;
    var currentTop;
    var muuriContainer;
    var dragContainer;
    var offsetDiff;
    var elementGBCR;
    var i;

    // If item is not active, don't start the drag.
    if (!item._isActive) {
      return;
    }

    // Stop current positioning animation.
    if (item._isPositioning) {
      item._stopLayout(true);
    }

    // If item is being released reset release data, remove release class and
    // import the element styles from release data to drag data.
    if (release.isActive) {
      drag.elementStyles = release.elementStyles;
      removeClass(item._element, stn.itemReleasingClass);
      inst._setupReleaseData();
    }

    // Setup drag data.
    drag.isActive = true;
    drag.startEvent = e;
    drag.currentEvent = e;
    drag.element = item._element;

    // Get element's current position.
    currentLeft = getTranslateAsFloat(drag.element, 'x');
    currentTop = getTranslateAsFloat(drag.element, 'y');

    // Get container references.
    muuriContainer = muuri._element;
    dragContainer = stn.dragContainer;

    // Set initial left/top drag value.
    drag.left = drag.gridX = currentLeft;
    drag.top = drag.gridY = currentTop;

    // If a specific drag container is set and it is different from the
    // default muuri container we need to cast some extra spells.
    if (dragContainer && dragContainer !== muuriContainer) {

      // If dragged element is already in drag container.
      if (drag.element.parentNode === dragContainer) {

        // Get offset diff.
        offsetDiff = getContainerOffsetDiff(drag.element, muuriContainer);

        // Store the container offset diffs to drag data.
        drag.containerDiffX = offsetDiff.left;
        drag.containerDiffY = offsetDiff.top;

        // Set up relative drag position data.
        drag.gridX = currentLeft - drag.containerDiffX;
        drag.gridY = currentTop - drag.containerDiffY;

      }

      // If dragged element is not within the correct container.
      else {

        // Lock element's width, height, padding and margin before appending
        // to the temporary container because otherwise the element might
        // enlarge or shrink after the append procedure if the some of the
        // properties are defined in relative sizes.
        inst._freezeElement(drag);

        // Append element into correct container.
        dragContainer.appendChild(drag.element);

        // Get offset diff.
        offsetDiff = getContainerOffsetDiff(drag.element, muuriContainer);

        // Store the container offset diffs to drag data.
        drag.containerDiffX = offsetDiff.left;
        drag.containerDiffY = offsetDiff.top;

        // Set up drag position data.
        drag.left = currentLeft + drag.containerDiffX;
        drag.top = currentTop + drag.containerDiffY;

        // Fix position to account for the append procedure.
        setStyles(drag.element, {
          transform: 'translateX(' + drag.left + 'px) translateY(' + drag.top + 'px)'
        });

      }

    }

    // Get and store element's current offset from window's northwest corner.
    elementGBCR = drag.element.getBoundingClientRect();
    drag.elementClientX = elementGBCR.left;
    drag.elementClientY = elementGBCR.top;

    // Get drag scroll parents.
    drag.scrollParents = getScrollParents(drag.element);
    if (dragContainer && dragContainer !== muuriContainer) {
      drag.scrollParents = arrayUnique(drag.scrollParents.concat(getScrollParents(muuriContainer)));
    }

    // Bind scroll listeners.
    for (i = 0; i < drag.scrollParents.length; i++) {
      drag.scrollParents[i].addEventListener('scroll', inst._scrollHandler);
    }

    // Set drag class.
    addClass(drag.element, stn.itemDraggingClass);

    // Emit dragstart event.
    muuri._emitter.emit(evDragItemStart, item, e);

  };

  /**
   * Drag move handler.
   *
   * @protected
   * @memberof Drag.prototype
   */
  Drag.prototype._onDragMove = function (e) {

    var inst = this;
    var item = inst._item;
    var muuri = item._muuri;
    var stn = muuri._settings;
    var drag = inst._drag;
    var xDiff;
    var yDiff;

    // If item is not active, reset drag.
    if (!item._isActive) {
      inst._resetDrag();
      return;
    }

    // Get delta difference from last dragmove event.
    xDiff = e.deltaX - drag.currentEvent.deltaX;
    yDiff = e.deltaY - drag.currentEvent.deltaY;

    // Update current event.
    drag.currentEvent = e;

    // Update position data.
    drag.left += xDiff;
    drag.top += yDiff;
    drag.gridX += xDiff;
    drag.gridY += yDiff;
    drag.elementClientX += xDiff;
    drag.elementClientY += yDiff;

    // Update element's translateX/Y values.
    setStyles(drag.element, {
      transform: 'translateX(' + drag.left + 'px) translateY(' + drag.top + 'px)'
    });

    // Overlap handling.
    if (stn.dragSort) {
      inst._checkSortOverlap();
    }

    // Emit item-dragmove event.
    muuri._emitter.emit(evDragItemMove, item, e);

  };

  /**
   * Drag scroll handler.
   *
   * @protected
   * @memberof Drag.prototype
   */
  Drag.prototype._onDragScroll = function () {

    var inst = this;
    var item = inst._item;
    var muuri = item._muuri;
    var stn = muuri._settings;
    var drag = inst._drag;
    var muuriContainer = muuri._element;
    var dragContainer = stn.dragContainer;
    var elementGBCR = drag.element.getBoundingClientRect();
    var xDiff = drag.elementClientX - elementGBCR.left;
    var yDiff = drag.elementClientY - elementGBCR.top;
    var offsetDiff;

    // Update container diff.
    if (dragContainer && dragContainer !== muuriContainer) {

      // Get offset diff.
      offsetDiff = getContainerOffsetDiff(drag.element, muuriContainer);

      // Store the container offset diffs to drag data.
      drag.containerDiffX = offsetDiff.left;
      drag.containerDiffY = offsetDiff.top;

    }

    // Update position data.
    drag.left += xDiff;
    drag.top += yDiff;
    drag.gridX = drag.left - drag.containerDiffX;
    drag.gridY = drag.top - drag.containerDiffY;

    // Update element's translateX/Y values.
    setStyles(drag.element, {
      transform: 'translateX(' + drag.left + 'px) translateY(' + drag.top + 'px)'
    });

    // Overlap handling.
    if (stn.dragSort) {
      inst._checkSortOverlap();
    }

    // Emit item-dragscroll event.
    muuri._emitter.emit(evDragItemScroll, item);

  };

  /**
   * Drag end handler.
   *
   * @protected
   * @memberof Drag.prototype
   */
  Drag.prototype._onDragEnd = function (e) {

    var inst = this;
    var item = inst._item;
    var muuri = item._muuri;
    var stn = muuri._settings;
    var drag = inst._drag;
    var release = inst._release;
    var i;

    // If item is not active, reset drag.
    if (!item._isActive) {
      inst._resetDrag();
      return;
    }

    // Finish currently queued overlap check.
    if (stn.dragSort) {
      inst._checkSortOverlap('finish');
    }

    // Remove scroll listeners.
    for (i = 0; i < drag.scrollParents.length; i++) {
      drag.scrollParents[i].removeEventListener('scroll', inst._scrollHandler);
    }

    // Remove drag classname from element.
    removeClass(drag.element, stn.itemDraggingClass);

    // Emit item-dragend event.
    muuri._emitter.emit(evDragItemEnd, item, e);

    // Setup release data.
    release.containerDiffX = drag.containerDiffX;
    release.containerDiffY = drag.containerDiffY;
    release.element = drag.element;
    release.elementStyles = drag.elementStyles;

    // Reset drag data.
    inst._setupDragData();

    // Start the release process.
    inst._startRelease();

  };

  /**
   * Predicate
   * *********
   */

  /**
   * Generic predicate constructor.
   *
   * @private
   * @class
   * @param {Function} [onResolved]
   * @param {Function} [onRejected]
   */
  function Predicate(onResolved, onRejected) {

    this._isResolved = false;
    this._isRejected = false;
    this._onResolved = onResolved;
    this._onRejected = onRejected;

  }

  /**
   * Predicate - Public prototype methods
   * ************************************
   */

  /**
   * Check if predicate is resolved.
   *
   * @public
   * @memberof Predicate.prototype
   * returns {Boolean}
   */
  Predicate.prototype.isResolved = function () {

    return this._isResolved;

  };

  /**
   * Check if predicate is rejected.
   *
   * @public
   * @memberof Predicate.prototype
   * returns {Boolean}
   */
  Predicate.prototype.isRejected = function () {

    return this._isRejected;

  };

  /**
   * Resolve predicate.
   *
   * @public
   * @memberof Predicate.prototype
   */
  Predicate.prototype.resolve = function () {

    if (!this._isRejected && !this._isResolved) {
      this._isResolved = true;
      if (typeof this._onResolved === 'function') {
        this._onResolved.call(this);
      }
      this._onResolved = this._onRejected = null;
    }

  };

  /**
   * Reject predicate.
   *
   * @public
   * @memberof Predicate.prototype
   */
  Predicate.prototype.reject = function () {

    if (!this._isRejected && !this._isResolved) {
      this._isRejected = true;
      if (typeof this._onRejected === 'function') {
        this._onRejected.call(this);
      }
      this._onResolved = this._onRejected = null;
    }

  };

  /**
   * Helpers - Generic
   * *****************
   */

  /**
   * Normalize array index. Basically this function makes sure that the provided
   * array index is within the bounds of the provided array and also transforms
   * negative index to the matching positive index.
   *
   * @private
   * @param {Array} array
   * @param {Number} index
   */
  function normalizeArrayIndex(array, index) {

    var length = array.length;
    var maxIndex = length - 1;

    if (index > maxIndex) {
      return maxIndex;
    }
    else if (index < 0) {
      return Math.max(length + index, 0);
    }

    return index;

  }

  /**
   * Swap array items.
   *
   * @private
   * @param {Array} array
   * @param {Number} index
   *   - Index (positive or negative) of the item that will be swapped.
   * @param {Number} withIndex
   *   - Index (positive or negative) of the other item that will be swapped.
   */
  function arraySwap(array, index, withIndex) {

    // Make sure the array has two or more items.
    if (array.length < 2) {
      return;
    }

    // Normalize the indices.
    var indexA = normalizeArrayIndex(array, index);
    var indexB = normalizeArrayIndex(array, withIndex);
    var temp;

    // Swap the items.
    if (indexA !== indexB) {
      temp = array[indexA];
      array[indexA] = array[indexB];
      array[indexB] = temp;
    }

  }

  /**
   * Move array item to another index.
   *
   * @private
   * @param {Array} array
   * @param {Number} fromIndex
   *   - Index (positive or negative) of the item that will be moved.
   * @param {Number} toIndex
   *   - Index (positive or negative) where the item should be moved to.
   */
  function arrayMove(array, fromIndex, toIndex) {

    // Make sure the array has two or more items.
    if (array.length < 2) {
      return;
    }

    // Normalize the indices.
    var from = normalizeArrayIndex(array, fromIndex);
    var to = normalizeArrayIndex(array, toIndex);

    // Add target item to the new position.
    if (from !== to) {
      array.splice(to, 0, array.splice(from, 1)[0]);
    }

  }

  /**
   * Returns a new duplicate free version of the provided array.
   *
   * @private
   * @param {Array} array
   * @returns {Array}
   */
  function arrayUnique(array) {

    var ret = [];
    var len = array.length;
    var i;

    if (len) {
      ret[0] = array[0];
      for (i = 1; i < len; i++) {
        if (ret.indexOf(array[i]) < 0) {
          ret[ret.length] = array[i];
        }
      }
    }

    return ret;

  }

  /**
   * Check if a value is a plain object.
   *
   * @private
   * @param {*} val
   * @returns {Boolean}
   */
  function isPlainObject(val) {

    return typeof val === 'object' && Object.prototype.toString.call(val) === '[object Object]';

  }

  /**
   * Check if a value is a node list
   *
   * @private
   * @param {*} val
   * @returns {Boolean}
   */
  function isNodeList(val) {

    var type = Object.prototype.toString.call(val);

    return type === '[object HTMLCollection]' || type === '[object NodeList]';

  }

  /**
   * Merge two objects recursively (deep merge). The source object's properties
   * are merged to the target object.
   *
   * @private
   * @param {Object} target
   *   - The target object.
   * @param {Object} source
   *   - The source object.
   * @returns {Object} Returns the target object.
   */
  function mergeObjects(target, source) {

    // Loop through the surce object's props.
    Object.keys(source).forEach(function (propName) {

      var isObject = isPlainObject(source[propName]);

      // If target and source values are both objects, merge the objects and
      // assign the merged value to the target property.
      if (isPlainObject(target[propName]) && isObject) {
        target[propName] = mergeObjects({}, target[propName]);
        target[propName] = mergeObjects(target[propName], source[propName]);
      }
      // Otherwise set the source object's value to target object and make sure
      // that object and array values are cloned and directly assigned.
      else {
        target[propName] = isObject ? mergeObjects({}, source[propName]) :
                           Array.isArray(source[propName]) ? source[propName].slice(0) :
                           source[propName];
      }

    });

    return target;

  }

  /**
   * Sanitizes styles definition object within settings. Basically just removes
   * all properties that have a value of null or undefined.
   *
   * @private
   * @param {Object} styles
   * @returns {Object} Returns a new object.
   */
  function sanitizeStyleSettings(styles) {

    var ret = {};

    Object.keys(styles).forEach(function (prop) {
      var val = styles[prop];
      if (val !== undefined && val !== null) {
        ret[prop] = val;
      }
    });

    return ret;

  }

  /**
   * Merge default settings with user settings. The returned object is a new
   * object with merged values. The merging is a deep merge meaning that all
   * objects and arrays within the provided settings objects will be also merged
   * so that modifying the values of the settings object will have no effect on
   * the returned object.
   *
   * @private
   * @param {Object} defaultSettings
   * @param {Object} [userSettings]
   * @returns {Object} Returns a new object.
   */
  function mergeSettings(defaultSettings, userSettings) {

    // Create a fresh copy of default settings.
    var ret = mergeObjects({}, defaultSettings);

    // Merge user settings to default settings.
    ret = userSettings ? mergeObjects(ret, userSettings) : ret;

    // Sanitize show styles (if they exist).
    if (ret.show && ret.show.styles) {
      ret.show.styles = sanitizeStyleSettings(ret.show.styles);
    }

    // Sanitize hide styles (if they exist).
    if (ret.hide && ret.hide.styles) {
      ret.hide.styles = sanitizeStyleSettings(ret.hide.styles);
    }

    return ret;

  }

  /**
   * Insert an item or an array of items to array to a specified index. Mutates
   * the array. The index can be negative in which case the items will be added
   * to the end of the array.
   *
   * @private
   * @param {Array} array
   * @param {*} items
   * @param {Number} [index=-1]
   */
  function insertItemsToArray(array, items, index) {

    var targetIndex = typeof index === 'number' ? index : -1;
    array.splice.apply(array, [targetIndex < 0 ? array.length - targetIndex + 1 : targetIndex, 0].concat(items));

  }

  /**
   * Returns a function, that, as long as it continues to be invoked, will not
   * be triggered. The function will be called after it stops being called for
   * N milliseconds. The returned function accepts one argument which, when
   * being "finish", calls the debounced function immediately if it is currently
   * waiting to be called, and when being "cancel" cancels the currently queued
   * function call.
   *
   * @private
   * @param {Function} fn
   * @param {Number} wait
   * @returns {Function}
   */
  function debounce(fn, wait) {

    var timeout;
    var actionCancel = 'cancel';
    var actionFinish = 'finish';

    return wait > 0 ? function (action) {

      if (timeout !== undefined) {
        timeout = global.clearTimeout(timeout);
        if (action === actionFinish) {
          fn();
        }
      }

      if (action !== actionCancel && action !== actionFinish) {
        timeout = global.setTimeout(function () {
          timeout = undefined;
          fn();
        }, wait);
      }

    } : function (action) {

      if (action !== actionCancel) {
        fn();
      }

    };

  }

  /**
   * Helpers - DOM utils
   * *******************
   */

  /**
   * Returns the computed value of an element's style property as a string.
   *
   * @private
   * @param {HTMLElement} element
   * @param {String} style
   * @returns {String}
   */
  function getStyle(element, style) {

    return global.getComputedStyle(element, null).getPropertyValue(style === 'transform' ? transform.styleName || style : style);

  }

  /**
   * Returns the computed value of an element's style property transformed into
   * a float value.
   *
   * @private
   * @param {HTMLElement} el
   * @param {String} style
   * @returns {Number}
   */
  function getStyleAsFloat(el, style) {

    return parseFloat(getStyle(el, style)) || 0;

  }

  /**
   * Returns the element's computed translateX/Y value as a float. Assumes that
   * the translate value is defined as pixels.
   *
   * @private
   * @param {HTMLElement} element
   * @param {String} axis
   *   - "x" or "y".
   * @returns {Number}
   */
  function getTranslateAsFloat(element, axis) {

    return parseFloat((getStyle(element, 'transform') || '').replace('matrix(', '').split(',')[axis === 'x' ? 4 : 5]) || 0;

  }

  /**
   * Set inline styles to an element.
   *
   * @private
   * @param {HTMLElement} element
   * @param {Object} styles
   */
  function setStyles(element, styles) {

    var props = Object.keys(styles);
    var prop;
    var val;
    var i;

    for (i = 0; i < props.length; i++) {

      prop = props[i];
      val = styles[prop];

      if (prop === 'transform' && transform) {
        prop = transform.propName;
      }

      element.style[prop] = val;

    }

  }

  /**
   * Set inline styles to an element using Velocity's hook method.
   *
   * @private
   * @param {HTMLElement} element
   * @param {Object} styles
   */
  function hookStyles(element, styles) {

    var props = Object.keys(styles);
    var i;

    for (i = 0; i < props.length; i++) {
      Velocity.hook(element, props[i], styles[props[i]]);
    }

  }

  /**
   * Check if an element has a specific class name.
   *
   * @private
   * @param {HTMLElement} element
   * @param {String} className
   * @returns {Boolean}
   */
  function hasClass(element, className) {

    return (
      element.matches ||
      element.matchesSelector ||
      element.msMatchesSelector ||
      element.mozMatchesSelector ||
      element.webkitMatchesSelector ||
      element.oMatchesSelector
    ).call(element, '.' + className);

  }

  /**
   * Add class to an element.
   *
   * @private
   * @param {HTMLElement} element
   * @param {String} className
   */
  function addClass(element, className) {

    if (element.classList) {
      element.classList.add(className);
    }
    else if (hasClass(element, className)) {
      element.className += ' ' + className;
    }

  }

  /**
   * Remove class name from an element.
   *
   * @private
   * @param {HTMLElement} element
   * @param {String} className
   */
  function removeClass(element, className) {

    if (element.classList) {
      element.classList.remove(className);
    }
    else if (hasClass(element, className)) {
      element.className = (' ' + element.className + ' ').replace(' ' + className + ' ', ' ').trim();
    }

  }

  /**
   * Returns the supported style property's prefix, property name and style name
   * or null if the style property is not supported. This is used for getting
   * the supported transform.
   *
   * @private
   * @param {String} style
   * @returns {?Object}
   */
  function getSupportedStyle(style) {

    var docElem = document.documentElement;
    var styleCap = style.charAt(0).toUpperCase() + style.slice(1);
    var prefixes = ['', 'Webkit', 'Moz', 'O', 'ms'];
    var prefix;
    var propName;
    var i;

    for (i = 0; i < prefixes.length; i++) {

      prefix = prefixes[i];
      propName = prefix ? prefix + styleCap : style;

      if (docElem.style[propName] !== undefined) {

        prefix = prefix.toLowerCase();

        return {
          prefix: prefix,
          propName: propName,
          styleName: prefix ? '-' + prefix + '-' + style : style
        };

      }

    }

    return null;

  }

  /**
   * Calculate the offset difference between an element's containing block
   * element and another element.
   *
   * @private
   * @param {HTMLElement} element
   * @param {HTMLElement} anchor
   * @returns {PlaceData}
   */
  function getContainerOffsetDiff(element, anchor) {

    var container = getContainingBlock(element) || document;
    var ret = {
      left: 0,
      top: 0
    };
    var containerOffset;
    var anchorOffset;

    if (container === anchor) {
      return ret;
    }

    containerOffset = getOffsetFromDocument(container, 'padding');
    anchorOffset = getOffsetFromDocument(anchor, 'padding');

    return {
      left: anchorOffset.left - containerOffset.left,
      top: anchorOffset.top - containerOffset.top
    };

  }

  /**
   * Helpers - Borrowed/forked from other libraries
   * **********************************************
   */

  /**
   * Get element's scroll parents.
   *
   * Borrowed from jQuery UI library (and heavily modified):
   * https://github.com/jquery/jquery-ui/blob/63448148a217da7e64c04b21a04982f0d64aabaa/ui/scroll-parent.js
   *
   * @private
   * @param {HTMLElement} element
   * @returns {Array}
   */
  function getScrollParents(element) {

    var ret = [];
    var overflowRegex = /(auto|scroll)/;
    var parent = element.parentNode;

    // If transformed elements leak fixed elements.
    if (transformLeaksFixed) {

      // If the element is fixed it can not have any scroll parents.
      if (getStyle(element, 'position') === 'fixed') {
        return ret;
      }

      // Find scroll parents.
      while (parent && parent !== document && parent !== document.documentElement) {
        if (overflowRegex.test(getStyle(parent, 'overflow') + getStyle(parent, 'overflow-y') + getStyle(parent, 'overflow-x'))) {
          ret[ret.length] = parent;
        }
        parent = getStyle(parent, 'position') === 'fixed' ? null : parent.parentNode;
      }

      // If parent is not fixed element, add window object as the last scroll
      // parent.
      if (parent !== null) {
        ret[ret.length] = global;
      }

    }
    // If fixed elements behave as defined in the W3C specification.
    else {

      // Find scroll parents.
      while (parent && parent !== document) {

        // If the currently looped element is fixed ignore all parents that are
        // not transformed.
        if (getStyle(element, 'position') === 'fixed' && !isTransformed(parent)) {
          parent = parent.parentNode;
          continue;
        }

        // Add the parent element to return items if it is scrollable.
        if (overflowRegex.test(getStyle(parent, 'overflow') + getStyle(parent, 'overflow-y') + getStyle(parent, 'overflow-x'))) {
          ret[ret.length] = parent;
        }

        // Update element and parent references.
        element = parent;
        parent = parent.parentNode;

      }

      // Replace reference of possible root element to window object.
      if (ret.length && ret[ret.length - 1] === document.documentElement) {
        ret[ret.length - 1] = global;
      }

    }

    return ret;

  }

  /**
   * Detects if transformed elements leak fixed elements. According W3C
   * transform rendering spec a transformed element should contain even fixed
   * elements. Meaning that fixed elements are positioned relative to the
   * closest transformed ancestor element instead of window. However, not every
   * browser follows the spec (IE and older Firefox). So we need to test it.
   * https://www.w3.org/TR/css3-2d-transforms/#transform-rendering
   *
   * Borrowed from Mezr (v0.6.1):
   * https://github.com/niklasramo/mezr/blob/0.6.1/mezr.js#L607
   *
   * @private
   * @returns {Boolean}
   *   - Returns true if transformed elements leak fixed elements, false
   *     otherwise.
   */
  function doesTransformLeakFixed() {

    if (!transform) {
      return true;
    }

    var outer = document.createElement('div');
    var inner = document.createElement('div');
    var leftNotTransformed;
    var leftTransformed;

    setStyles(outer, {
      display: 'block',
      visibility: 'hidden',
      position: 'absolute',
      width: '1px',
      height: '1px',
      left: '1px',
      top: '0',
      margin: '0',
      transform: 'none'
    });

    setStyles(inner, {
      display: 'block',
      position: 'fixed',
      width: '1px',
      height: '1px',
      left: '0',
      top: '0',
      margin: '0',
      transform: 'none'
    });

    outer.appendChild(inner);
    document.body.appendChild(outer);
    leftNotTransformed = inner.getBoundingClientRect().left;
    outer.style[transform.propName] = 'scaleX(1)';
    leftTransformed = inner.getBoundingClientRect().left;
    document.body.removeChild(outer);

    return leftTransformed === leftNotTransformed;

  }

  /**
   * Returns true if element is transformed, false if not. In practice the element's display value
   * must be anything else than "none" or "inline" as well as have a valid transform value applied
   * in order to be counted as a transformed element.
   *
   * Borrowed from Mezr (v0.6.1):
   * https://github.com/niklasramo/mezr/blob/0.6.1/mezr.js#L661
   *
   * @private
   * @param {HTMLElement} element
   * @returns {Boolean}
   */
  function isTransformed(element) {

    var transform = getStyle(element, 'transform');
    var display = getStyle(element, 'display');

    return transform !== 'none' && display !== 'inline' && display !== 'none';

  }

  /**
   * Returns the element's containing block.
   *
   * Borrowed from Mezr (v0.6.1):
   * https://github.com/niklasramo/mezr/blob/0.6.1/mezr.js#L274
   *
   * @private
   * @param {Document|HTMLElement|Window} element
   * @returns {?Document|HTMLElement|Window}
   */
  function getContainingBlock(element) {

    // If we have document return null right away.
    if (element === document) {
      return null;
    }

    // If we have window return document right away.
    if (element === global) {
      return document;
    }

    // Now that we know we have an element in our hands, let's get it's position. Get element's
    // current position value if a specific position is not provided.
    var position = getStyle(element, 'position');

    // Relative element's container is always the element itself.
    if (position === 'relative') {
      return element;
    }

    // If element is not positioned (static or an invalid position value), always return null.
    if (position !== 'fixed' && position !== 'absolute') {
      return null;
    }

    // If the element is fixed and transforms leak fixed elements, always return window.
    if (position === 'fixed' && transformLeaksFixed) {
      return global;
    }

    // Alrighty, so now fetch the element's parent (which is document for the root) and set it as
    // the initial containing block. Fallback to null if everything else fails.
    var ret = element === document.documentElement ? document : element.parentElement || null;

    // If element is fixed positioned.
    if (position === 'fixed') {

      // As long as the containing block is an element and is not transformed, try to get the
      // element's parent element and fallback to document.
      while (ret && ret !== document && !isTransformed(ret)) {
        ret = ret.parentElement || document;
      }

      return ret === document ? global : ret;

    }

    // If the element is absolute positioned.
    else {

      // As long as the containing block is an element, is static and is not transformed, try to
      // get the element's parent element and fallback to document.
      while (ret && ret !== document && getStyle(ret, 'position') === 'static' && !isTransformed(ret)) {
        ret = ret.parentElement || document;
      }

      return ret;

    }

  }

  /**
   * Returns the element's (or window's) document offset, which in practice
   * means the vertical and horizontal distance between the element's northwest
   * corner and the document's northwest corner.
   *
   * Borrowed from Mezr (v0.6.1):
   * https://github.com/niklasramo/mezr/blob/0.6.1/mezr.js#L1006
   *
   * @private
   * @param {Document|HTMLElement|Window} element
   * @param {Edge} [edge='border']
   * @returns {Object}
   */
  function getOffsetFromDocument(element, edge) {

    var ret = {
      left: 0,
      top: 0
    };

    // Document's offsets are always 0.
    if (element === document) {
      return ret;
    }

    // Add viewport's scroll left/top to the respective offsets.
    ret.left = global.pageXOffset || 0;
    ret.top = global.pageYOffset || 0;

    // Window's offsets are the viewport's scroll left/top values.
    if (element.self === global.self) {
      return ret;
    }

    // Now we know we are calculating an element's offsets so let's first get the element's
    // bounding client rect. If it is not cached, then just fetch it.
    var gbcr = element.getBoundingClientRect();

    // Add bounding client rect's left/top values to the offsets.
    ret.left += gbcr.left;
    ret.top += gbcr.top;

    // Sanitize edge.
    edge = edge || 'border';

    // Exclude element's positive margin size from the offset if needed.
    if (edge === 'margin') {
      var marginLeft = getStyleAsFloat(element, 'margin-left');
      var marginTop = getStyleAsFloat(element, 'margin-top');
      ret.left -= marginLeft > 0 ? marginLeft : 0;
      ret.top -= marginTop > 0 ? marginTop : 0;
    }

    // Include element's border size to the offset if needed.
    else if (edge !== 'border') {
      ret.left += getStyleAsFloat(element, 'border-left-width');
      ret.top += getStyleAsFloat(element, 'border-top-width');
    }

    // Include element's padding size to the offset if needed.
    if (edge === 'content') {
      ret.left += getStyleAsFloat(element, 'padding-left');
      ret.top += getStyleAsFloat(element, 'padding-top');
    }

    return ret;

  }

  /**
   * Browsers allow dragging links and images by creating a "ghost image", which
   * interferes with Muuri's drag flow. This function prevents that from
   * happening.
   *
   * @private
   * @param {HTMLElement} element
   */
  function disableNativeDrag(element) {

    var tagName = element.tagName.toLowerCase();
    if (tagName === 'a' || tagName === 'img') {
      element.addEventListener('dragstart', preventDefault, false);
    }

  }

  /**
   * Removes native image/link drag prevention hacks from an element.
   *
   * @private
   * @param {HTMLElement} element
   */
  function enableNativeDrag(element) {

    var tagName = element.tagName.toLowerCase();
    if (tagName === 'a' || tagName === 'img') {
      element.removeEventListener('dragstart', preventDefault, false);
    }

  }

  /**
   * Helpers - Muuri
   * ***************
   */

  /**
   * Show or hide Muuri instance's items.
   *
   * @private
   * @param {Muuri} inst
   * @param {String} method - "show" or "hide".
   * @param {Array|HTMLElement|Item|Number} items
   * @param {Boolean} [instant=false]
   * @param {Function} [callback]
   */
  function setVisibility(inst, method, items, instant, callback) {

    var targetItems = inst.getItems(items);
    var cb = typeof instant === 'function' ? instant : callback;
    var counter = targetItems.length;
    var isShow = method === 'show';
    var startEvent = isShow ? evShowItemsStart : evHideItemsStart;
    var endEvent = isShow ? evShowItemsEnd : evHideItemsEnd;
    var isInstant = instant === true;
    var needsRelayout = false;
    var completedItems;
    var hiddenItems;
    var item;
    var i;

    // If there are no items call the callback, but don't emit any events.
    if (!counter) {

      if (typeof callback === 'function') {
        callback(targetItems);
      }

    }
    // If we have some items let's dig in.
    else {

      completedItems = [];
      hiddenItems = [];

      // Emit showstart event.
      inst._emitter.emit(startEvent, targetItems);

      // Show/hide items.
      for (i = 0; i < targetItems.length; i++) {

        item = targetItems[i];

        // Check if relayout or refresh is needed.
        if ((isShow && !item._isActive) || (!isShow && item._isActive)) {
          needsRelayout = true;
          if (isShow) {
            item._noLayoutAnimation = true;
            hiddenItems[hiddenItems.length] = item;
          }
        }

        // Show/hide the item.
        item['_' + method](isInstant, function (interrupted, item) {

          // If the current item's animation was not interrupted add it to the
          // completedItems array.
          if (!interrupted) {
            completedItems[completedItems.length] = item;
          }

          // If all items have finished their animations call the callback
          // and emit the event.
          if (--counter < 1) {
            if (typeof cb === 'function') {
              cb(completedItems);
            }
            inst._emitter.emit(endEvent, completedItems);
          }

        });

      }

      // Relayout only if needed.
      if (needsRelayout) {
        if (hiddenItems.length) {
          inst.refreshItems(hiddenItems);
        }
        inst.layoutItems();
      }

    }

  }

  /**
   * Returns an object which contains start and stop methods for item's
   * show/hide process.
   *
   * @param {String} type
   * @param {?Object} [opts]
   * @param {Number} [opts.duration]
   * @param {String} [opts.easing]
   * @returns {Object}
   */
  function getItemVisbilityHandler(type, opts) {

    var duration = parseInt(opts && opts.duration) || 0;
    var isEnabled = duration > 0;
    var easing = (opts && opts.easing) || 'ease';
    var styles = opts && isPlainObject(opts.styles) ? opts.styles : null;

    return {
      start: function (item, instant, animDone) {

        var animateOpts;

        if (!isEnabled || !styles) {

          if (animDone) {
            animDone();
          }

        }
        else if (instant) {

          if (item._isDefaultChildAnimate) {
            hookStyles(item._child, styles);
          }
          else {
            setStyles(item._child, styles);
          }

          if (animDone) {
            animDone();
          }

        }
        else {

          animateOpts = {
            duration: duration,
            easing: easing,
            done: animDone
          };

          if (item._isDefaultChildAnimate) {
            item._animateChild.start(null, styles, animateOpts);
          }
          else {
            item._animateChild.start(styles, animateOpts);
          }

        }
      },
      stop: function (item) {

        item._animateChild.stop();

      }
    };

  }

  /**
   * Process item's callback queue.
   *
   * @private
   * @param {Array} queue
   * @param {Boolean} interrupted
   * @param {Item} instance
   */
  function processQueue(queue, interrupted, instance) {

    var callbacks = queue.splice(0, queue.length);
    var i;

    for (i = 0; i < callbacks.length; i++) {
      callbacks[i](interrupted, instance);
    }

  }

  /**
   * Calculate how many percent the intersection area of two items is from the
   * maximum potential intersection area between the items.
   *
   * @private
   * @param {Object} a
   * @param {Object} b
   * @returns {Number}
   *   - A number between 0-100.
   */
  function getOverlapScore(a, b) {

    // Return 0 immediately if the rectangles do not overlap.
    if ((a.left + a.width) <= b.left || (b.left + b.width) <= a.left || (a.top + a.height) <= b.top || (b.top + b.height) <= a.top) {
      return 0;
    }

    // Calculate inersection area width and height.
    var width = Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left);
    var height = Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top);

    // Calculate maximum intersection area width and height.
    var maxWidth = Math.min(a.width, b.width);
    var maxHeight = Math.min(a.height, b.height);

    return (width * height) / (maxWidth * maxHeight) * 100;

  }

  /**
   * Prevent default.
   *
   * @private
   * @param {Object} e
   */
  function preventDefault(e) {

    if (e.preventDefault) {
      e.preventDefault();
    }

  }

  /**
   * Init
   */

  return Muuri;

}));
