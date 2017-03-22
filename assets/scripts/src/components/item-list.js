export default class ItemList {
  constructor(element, instance) {
    this.element = element;
    this.instance = instance;
    this.instance.config = instance.config;
    this.classNames = instance.config.classNames;
  }

  /**
   * Clear element inner HTML
   * @return
   */
  clear() {
    this.element.innerHTML = '';
  }

  /**
   * Process click of an item
   * @param {Array}   activeItems The currently active items
   * @param {Element} element     Item being interacted with
   * @param {Boolean} hasShiftKey Whether the user has the shift key active
   * @return
   */
  handleItemAction(activeItems, element, hasShiftKey = false) {
    if (!activeItems || !element) {
      return;
    }

    // If we are clicking on an item
    if (this.instance.config.removeItems && this.instance.passedElement.type !== 'select-one') {
      const passedId = element.getAttribute('data-id');

      // We only want to select one item with a click
      // so we deselect any items that aren't the target
      // unless shift is being pressed
      activeItems.forEach((item) => {
        if (item.id === parseInt(passedId, 10) && !item.highlighted) {
          this.instance.highlightItem(item);
        } else if (!hasShiftKey) {
          if (item.highlighted) {
            this.instance.unhighlightItem(item);
          }
        }
      });

      // Focus input as without focus, a user cannot do anything with a
      // highlighted item
      if (document.activeElement !== this.input) {
        this.instance.input.focus();
      }
    }
  }

  /**
   * Process enter/click of an item button
   * @param {Array}   activeItems The currently active items
   * @param {Element} element     Button being interacted with
   * @return
   */
  handleButtonAction(activeItems, element) {
    if (!activeItems || !element) {
      return;
    }

    // If we are clicking on a button
    if (this.instance.config.removeItems && this.instance.config.removeItemButton) {
      const itemId = element.parentNode.getAttribute('data-id');
      const itemToRemove = activeItems.find((item) => item.id === parseInt(itemId, 10));

      // Remove item associated with button
      this.instance._removeItem(itemToRemove);
      this.instance._triggerChange(itemToRemove.value);

      if (this.instance.passedElement.type === 'select-one') {
        const placeholder = this.instance.config.placeholder ?
          (this.instance.config.placeholderValue || this.instance.passedElement.getAttribute('placeholder'))
          : false;
        if (placeholder) {
          const placeholderItem = this._getTemplate('placeholder', placeholder);
          this.element.appendChild(placeholderItem);
        }
      }
    }
  }
}
