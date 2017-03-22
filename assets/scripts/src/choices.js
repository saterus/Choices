import Fuse from 'fuse.js';
import Dropdown from './components/dropdown.js';
import Container from './components/container.js';
import ChoiceList from './components/choice-list.js';
import ItemList from './components/item-list.js';
import Input from './components/input.js';
import Store from './store/index.js';
import {
  addItem,
  removeItem,
  highlightItem,
  addChoice,
  filterChoices,
  activateChoices,
  addGroup,
  clearAll,
  clearChoices,
}
from './actions/index';
import {
  isScrolledIntoView,
  getAdjacentEl,
  wrap,
  getType,
  isType,
  isElement,
  strToEl,
  extend,
  getWidthOfInput,
  sortByAlpha,
  sortByScore,
  triggerEvent,
}
from './lib/utils.js';
import './lib/polyfills.js';


/**
 * Choices
 */
class Choices {
  constructor(element = '[data-choice]', userConfig = {}) {
    // If there are multiple elements, create a new instance
    // for each element besides the first one (as that already has an instance)
    if (isType('String', element)) {
      const elements = document.querySelectorAll(element);
      if (elements.length > 1) {
        for (let i = 1; i < elements.length; i++) {
          const el = elements[i];
          new Choices(el, userConfig);
        }
      }
    }

    const defaultConfig = {
      items: [],
      choices: [],
      maxItemCount: -1,
      addItems: true,
      removeItems: true,
      removeItemButton: false,
      editItems: false,
      duplicateItems: true,
      delimiter: ',',
      paste: true,
      search: true,
      searchFloor: 1,
      position: 'auto',
      resetScrollPosition: true,
      regexFilter: null,
      shouldSort: true,
      sortFilter: sortByAlpha,
      sortFields: ['label', 'value'],
      placeholder: true,
      placeholderValue: null,
      prependValue: null,
      appendValue: null,
      loadingText: 'Loading...',
      noResultsText: 'No results found',
      noChoicesText: 'No choices to choose from',
      itemSelectText: 'Press to select',
      addItemText: (value) => {
        return `Press Enter to add <b>"${value}"</b>`;
      },
      maxItemText: (maxItemCount) => {
        return `Only ${maxItemCount} values can be added.`;
      },
      uniqueItemText: 'Only unique values can be added.',
      classNames: {
        containerOuter: 'choices',
        containerInner: 'choices__inner',
        input: 'choices__input',
        inputCloned: 'choices__input--cloned',
        list: 'choices__list',
        listItems: 'choices__list--multiple',
        listSingle: 'choices__list--single',
        listDropdown: 'choices__list--dropdown',
        item: 'choices__item',
        itemSelectable: 'choices__item--selectable',
        itemDisabled: 'choices__item--disabled',
        itemChoice: 'choices__item--choice',
        placeholder: 'choices__placeholder',
        group: 'choices__group',
        groupHeading: 'choices__heading',
        button: 'choices__button',
        activeState: 'is-active',
        focusState: 'is-focused',
        openState: 'is-open',
        disabledState: 'is-disabled',
        highlightedState: 'is-highlighted',
        hiddenState: 'is-hidden',
        flippedState: 'is-flipped',
        loadingState: 'is-loading',
      },
      fuseOptions: {
        include: 'score',
      },
      callbackOnInit: null,
      callbackOnCreateTemplates: null,
    };

    // Merge options with user options
    this.config = extend(defaultConfig, userConfig);

    // Create data store
    this.store = new Store(this.render);

    // State tracking
    this.initialised = false;
    this.currentState = {};
    this.prevState = {};
    this.currentValue = '';

    // Retrieve triggering element (i.e. element with 'data-choice' trigger)
    this.element = element;
    this.passedElement = isType('String', element) ? document.querySelector(element) : element;
    this.isSelectElement = this.passedElement.type === 'select-one' || this.passedElement.type === 'select-multiple';
    this.isTextElement = this.passedElement.type === 'text';

    if (!this.passedElement) {
      console.error('Passed element not found');
      return;
    }

    this.highlightPosition = 0;
    this.canSearch = this.config.search;

    // Assing preset choices from passed object
    this.presetChoices = this.config.choices;

    // Assign preset items from passed object first
    this.presetItems = this.config.items;

    // Then add any values passed from attribute
    if (this.passedElement.value) {
      this.presetItems = this.presetItems.concat(this.passedElement.value.split(this.config.delimiter));
    }

    // Bind methods
    this.init = this.init.bind(this);
    this.render = this.render.bind(this);
    this.destroy = this.destroy.bind(this);
    this.disable = this.disable.bind(this);

    // Bind event handlers
    this._onFocus = this._onFocus.bind(this);
    this._onBlur = this._onBlur.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onClick = this._onClick.bind(this);
    this._onTouchMove = this._onTouchMove.bind(this);
    this._onTouchEnd = this._onTouchEnd.bind(this);
    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseOver = this._onMouseOver.bind(this);
    this._onPaste = this._onPaste.bind(this);
    this._onInput = this._onInput.bind(this);

    // Monitor touch taps/scrolls
    this.wasTap = true;

    // Cutting the mustard
    if (!'classList' in document.documentElement) {
      console.error('Choices: Your browser doesn\'t support Choices');
    }

    // Input type check
    const isValidType = ['select-one', 'select-multiple', 'text'].some(type => type === this.passedElement.type);
    const canInit = isElement(this.passedElement) && isValidType;

    if (canInit) {
      // If element has already been initalised with Choices
      if (this.passedElement.getAttribute('data-choice') === 'active') {
        return;
      }

      // Let's go
      this.init();
    } else {
      console.error('Incompatible input passed');
    }
  }

  /*========================================
  =            Public functions            =
  ========================================*/

  /**
   * Initialise Choices
   * @return
   */
  init() {
    if (this.initialised === true) {
      return;
    }

    const callback = this.config.callbackOnInit;

    // Set initialise flag
    this.initialised = true;
    // Create required elements
    this._createTemplates();
    // Generate input markup
    this._createInput();
    // Subscribe store to render method
    this.store.subscribe(this.render);
    // Render any items
    this.render();
    // Trigger event listeners
    this._addEventListeners();

    // Run callback if it is a function
    if (callback) {
      if (isType('Function', callback)) {
        callback.call(this);
      }
    }
  }

  /**
   * Destroy Choices and nullify values
   * @return
   */
  destroy() {
    if (this.initialised === false) {
      return;
    }

    // Remove all event listeners
    this._removeEventListeners();

    // Reinstate passed element
    this.passedElement.classList.remove(
      this.config.classNames.input,
      this.config.classNames.hiddenState
    );

    this.passedElement.removeAttribute('tabindex');
    this.passedElement.removeAttribute('style', 'display:none;');
    this.passedElement.removeAttribute('aria-hidden');
    this.passedElement.removeAttribute('data-choice', 'active');

    // Re-assign values - this is weird, I know
    this.passedElement.value = this.passedElement.value;

    // Move passed element back to original position
    this.container.outer.parentNode.insertBefore(
      this.passedElement,
      this.container.outer
    );

    // Remove added elements
    this.container.outer.parentNode.removeChild(this.container.outer);

    // Clear data store
    this.clearStore();

    // Nullify instance-specific data
    this.config.templates = null;

    // Uninitialise
    this.initialised = false;
  }

  /**
   * Render group choices into a DOM fragment and append to choice list
   * @param  {Array} groups    Groups to add to list
   * @param  {Array} choices   Choices to add to groups
   * @param  {DocumentFragment} fragment Fragment to add groups and options to (optional)
   * @return {DocumentFragment} Populated options fragment
   */
  renderGroups(groups, choices, fragment) {
    const groupFragment = fragment || document.createDocumentFragment();
    const filter = this.config.sortFilter;

    // If sorting is enabled, filter groups
    if (this.config.shouldSort) {
      groups.sort(filter);
    }

    groups.forEach((group) => {
      // Grab options that are children of this group
      const groupChoices = choices.filter((choice) => {
        if (this.passedElement.type === 'select-one') {
          return choice.groupId === group.id;
        }
        return choice.groupId === group.id && !choice.selected;
      });

      if (groupChoices.length >= 1) {
        const dropdownGroup = this._getTemplate('choiceGroup', group);
        groupFragment.appendChild(dropdownGroup);
        this.renderChoices(groupChoices, groupFragment);
      }
    });

    return groupFragment;
  }

  /**
   * Render choices into a DOM fragment and append to choice list
   * @param  {Array} choices    Choices to add to list
   * @param  {DocumentFragment} fragment Fragment to add choices to (optional)
   * @return {DocumentFragment} Populated choices fragment
   */
  renderChoices(choices, fragment) {
    // Create a fragment to store our list items (so we don't have to update the DOM for each item)
    const choicesFragment = fragment || document.createDocumentFragment();
    const filter = this.isSearching ? sortByScore : this.config.sortFilter;

    // If sorting is enabled or the user is searching, filter choices
    if (this.config.shouldSort || this.isSearching) {
      choices.sort(filter);
    }

    choices.forEach((choice) => {
      const dropdownItem = this._getTemplate('choice', choice);
      const shouldRender = this.passedElement.type === 'select-one' || !choice.selected;
      if (shouldRender) {
        choicesFragment.appendChild(dropdownItem);
      }
    });

    return choicesFragment;
  }

  /**
   * Render items into a DOM fragment and append to items list
   * @param  {Array} items    Items to add to list
   * @param  {DocumentFragment} fragment Fragrment to add items to (optional)
   * @return
   */
  renderItems(items, fragment) {
    // Create fragment to add elements to
    const itemListFragment = fragment || document.createDocumentFragment();
    // Simplify store data to just values
    const itemsFiltered = this.store.getItemsReducedToValues(items);

    if (this.isTextElement) {
      // Assign hidden input array of values
      this.passedElement.setAttribute('value', itemsFiltered.join(this.config.delimiter));
    } else {
      const selectedOptionsFragment = document.createDocumentFragment();

      // Add each list item to list
      items.forEach((item) => {
        // Create a standard select option
        const option = this._getTemplate('option', item);
        // Append it to fragment
        selectedOptionsFragment.appendChild(option);
      });

      // Update selected choices
      this.passedElement.innerHTML = '';
      this.passedElement.appendChild(selectedOptionsFragment);
    }

    // Add each list item to list
    items.forEach((item) => {
      // Create new list element
      const listItem = this._getTemplate('item', item);
      // Append it to list
      itemListFragment.appendChild(listItem);
    });

    return itemListFragment;
  }

  /**
   * Render DOM with values
   * @return
   */
  render() {
    this.currentState = this.store.getState();

    // Only render if our state has actually changed
    if (this.currentState !== this.prevState) {
      // Choices
      if (this.currentState.choices !== this.prevState.choices ||
        this.currentState.groups !== this.prevState.groups) {
        if (this.passedElement.type === 'select-multiple' ||
            this.passedElement.type === 'select-one') {
          // Get active groups/choices
          const activeGroups = this.store.getGroupsFilteredByActive();
          const activeChoices = this.store.getChoicesFilteredByActive();

          let choiceListFragment = document.createDocumentFragment();

          // Clear choices
          this.choiceList.clear();

          // Scroll back to top of choices list
          if(this.config.resetScrollPosition){
            this.choiceList.resetScrollPosition();
          }

          // If we have grouped options
          if (activeGroups.length >= 1 && this.isSearching !== true) {
            choiceListFragment = this.renderGroups(activeGroups, activeChoices, choiceListFragment);
          } else if (activeChoices.length >= 1) {
            choiceListFragment = this.renderChoices(activeChoices, choiceListFragment);
          }

          if (choiceListFragment.childNodes && choiceListFragment.childNodes.length > 0) {
            // If we actually have anything to add to our dropdown
            // append it and highlight the first choice
            this.choiceList.element.appendChild(choiceListFragment);
            this.choiceList.highlightChoice();
          } else {
            // Otherwise show a notice
            let dropdownItem;
            let notice;

            if (this.isSearching) {
              notice = isType('Function', this.config.noResultsText) ? this.config.noResultsText() : this.config.noResultsText;
              dropdownItem = this._getTemplate('notice', notice);
            } else {
              notice = isType('Function', this.config.noChoicesText) ? this.config.noChoicesText() : this.config.noChoicesText;
              dropdownItem = this._getTemplate('notice', notice);
            }

            this.choiceList.element.appendChild(dropdownItem);
          }
        }
      }

      // Items
      if (this.currentState.items !== this.prevState.items) {
        const activeItems = this.store.getItemsFilteredByActive();
        if (activeItems) {
          // Create a fragment to store our list items
          // (so we don't have to update the DOM for each item)
          const itemListFragment = this.renderItems(activeItems);

          // Clear list
          this.itemList.clear();

          // If we have items to add
          if (itemListFragment.childNodes) {
            // Update list
            this.itemList.element.appendChild(itemListFragment);
          }
        }
      }

      this.prevState = this.currentState;
    }
  }

  /**
   * Select item (a selected item can be deleted)
   * @param  {Element} item Element to select
   * @return {Object} Class instance
   */
  highlightItem(item, runEvent = true) {
    if (!item) return;
    const id = item.id;
    const groupId = item.groupId;
    const group = groupId >= 0 ? this.store.getGroupById(groupId) : null;

    this.store.dispatch(highlightItem(id, true));

    if (runEvent) {
      if(group && group.value) {
        triggerEvent(this.passedElement, 'highlightItem', {
          id,
          value: item.value,
          label: item.label,
          groupValue: group.value
        });
      } else {
        triggerEvent(this.passedElement, 'highlightItem', {
          id,
          value: item.value,
          label: item.label,
        });
      }
    }

    return this;
  }

  /**
   * Deselect item
   * @param  {Element} item Element to de-select
   * @return {Object} Class instance
   */
  unhighlightItem(item) {
    if (!item) return;
    const id = item.id;
    const groupId = item.groupId;
    const group = groupId >= 0 ? this.store.getGroupById(groupId) : null;

    this.store.dispatch(highlightItem(id, false));

    if(group && group.value) {
      triggerEvent(this.passedElement, 'unhighlightItem', {
        id,
        value: item.value,
        label: item.label,
        groupValue: group.value
      });
    } else {
      triggerEvent(this.passedElement, 'unhighlightItem', {
        id,
        value: item.value,
        label: item.label,
      });
    }

    return this;
  }

  /**
   * Highlight items within store
   * @return {Object} Class instance
   */
  highlightAll() {
    const items = this.store.getItems();
    items.forEach((item) => {
      this.highlightItem(item);
    });

    return this;
  }

  /**
   * Deselect items within store
   * @return {Object} Class instance
   */
  unhighlightAll() {
    const items = this.store.getItems();
    items.forEach((item) => {
      this.unhighlightItem(item);
    });

    return this;
  }

  /**
   * Remove an item from the store by its value
   * @param  {String} value Value to search for
   * @return {Object} Class instance
   */
  removeItemsByValue(value) {
    if (!value || !isType('String', value)) {
      console.error('removeItemsByValue: No value was passed to be removed');
      return;
    }

    const items = this.store.getItemsFilteredByActive();

    items.forEach((item) => {
      if (item.value === value) {
        this._removeItem(item);
      }
    });

    return this;
  }

  /**
   * Remove all items from store array
   * @note Removed items are soft deleted
   * @param  {Number} excludedId Optionally exclude item by ID
   * @return {Object} Class instance
   */
  removeActiveItems(excludedId) {
    const items = this.store.getItemsFilteredByActive();

    items.forEach((item) => {
      if (item.active && excludedId !== item.id) {
        this._removeItem(item);
      }
    });

    return this;
  }

  /**
   * Remove all selected items from store
   * @note Removed items are soft deleted
   * @return {Object} Class instance
   */
  removeHighlightedItems(runEvent = false) {
    const items = this.store.getItemsFilteredByActive();

    items.forEach((item) => {
      if (item.highlighted && item.active) {
        this._removeItem(item);
        // If this action was performed by the user
        // trigger the event
        if (runEvent) {
          this._triggerChange(item.value);
        }
      }
    });

    return this;
  }

  /**
   * Get value(s) of input (i.e. inputted items (text) or selected choices (select))
   * @param {Boolean} valueOnly Get only values of selected items, otherwise return selected items
   * @return {Array/String} selected value (select-one) or array of selected items (inputs & select-multiple)
   */
  getValue(valueOnly = false) {
    const items = this.store.getItemsFilteredByActive();
    const selectedItems = [];

    items.forEach((item) => {
      if (this.isTextElement) {
        selectedItems.push(valueOnly ? item.value : item);
      } else if (item.active) {
        selectedItems.push(valueOnly ? item.value : item);
      }
    });

    if (this.passedElement.type === 'select-one') {
      return selectedItems[0];
    }

    return selectedItems;
  }

  /**
   * Set value of input. If the input is a select box, a choice will be created and selected otherwise
   * an item will created directly.
   * @param  {Array}   args  Array of value objects or value strings
   * @return {Object} Class instance
   */
  setValue(args) {
    if (this.initialised === true) {
      // Convert args to an iterable array
      const values = [...args],
        passedElementType = this.passedElement.type,
        handleValue = (item) => {
          const itemType = getType(item);
          if (itemType === 'Object') {
            if (!item.value) return;
            // If we are dealing with a select input, we need to create an option first
            // that is then selected. For text inputs we can just add items normally.
            if (passedElementType !== 'text') {
              this._addChoice(true, false, item.value, item.label, -1);
            } else {
              this._addItem(item.value, item.label, item.id);
            }
          } else if (itemType === 'String') {
            if (passedElementType !== 'text') {
              this._addChoice(true, false, item, item, -1);
            } else {
              this._addItem(item);
            }
          }
        };

      if (values.length > 1) {
        values.forEach((value) => {
          handleValue(value);
        });
      } else {
        handleValue(values[0]);
      }
    }
    return this;
  }

  /**
   * Select value of select box via the value of an existing choice
   * @param {Array/String} value An array of strings of a single string
   * @return {Object} Class instance
   */
  setValueByChoice(value) {
    if (this.passedElement.type !== 'text') {
      const choices = this.store.getChoices();
      // If only one value has been passed, convert to array
      const choiceValue = isType('Array', value) ? value : [value];

      // Loop through each value and
      choiceValue.forEach((val) => {
        const foundChoice = choices.find((choice) => {
          // Check 'value' property exists and the choice isn't already selected
          return choice.value === val;
        });

        if (foundChoice) {
          if (!foundChoice.selected) {
            this._addItem(foundChoice.value, foundChoice.label, foundChoice.id, foundChoice.groupId);
          } else {
            console.warn('Attempting to select choice already selected');
          }
        } else {
          console.warn('Attempting to select choice that does not exist');
        }
      });
    }
    return this;
  }

  /**
   * Direct populate choices
   * @param  {Array} choices - Choices to insert
   * @param  {String} value - Name of 'value' property
   * @param  {String} label - Name of 'label' property
   * @param  {Boolean} replaceChoices Whether existing choices should be removed
   * @return {Object} Class instance
   */
  setChoices(choices, value, label, replaceChoices = false) {
    if (this.initialised === true) {
      if (this.isSelectElement) {
        if (!isType('Array', choices) || !value) return;
        // Clear choices if needed
        if(replaceChoices) {
          this._clearChoices();
        }
        // Add choices if passed
        if (choices && choices.length) {
          this.container.stopLoader();
          choices.forEach((result, index) => {
            const isSelected = result.selected ? result.selected : false;
            const isDisabled = result.disabled ? result.disabled : false;
            if (result.choices) {
              this._addGroup(result, (result.id || null), value, label);
            } else {
              this._addChoice(isSelected, isDisabled, result[value], result[label]);
            }
          });
        }
      }
    }
    return this;
  }

  /**
   * Clear items,choices and groups
   * @note Hard delete
   * @return {Object} Class instance
   */
  clearStore() {
    this.store.dispatch(clearAll());
    return this;
  }

  /**
   * Enable interaction with Choices
   * @return {Object} Class instance
   */
  enable() {
    this.passedElement.disabled = false;
    const isDisabled = this.container.disabled;
    if (this.initialised && isDisabled) {
      this._addEventListeners();
      this.passedElement.removeAttribute('disabled');
      this.input.enable();
      this.container.enable();
    }
    return this;
  }

  /**
   * Disable interaction with Choices
   * @return {Object} Class instance
   */
  disable() {
    this.passedElement.disabled = true;
    const isEnabled = !this.container.disabled;

    if (this.initialised && isEnabled) {
      this._removeEventListeners();
      this.passedElement.setAttribute('disabled', '');
      this.input.disable();
      this.container.disable();
    }

    return this;
  }

  /**
   * Populate options via ajax callback
   * @param  {Function} fn Passed
   * @return {Object} Class instance
   */
  ajax(fn) {
    if (this.initialised === true) {
      if (this.isSelectElement) {
        // Show loading text
        this._handleLoadingState(true);
        // Run callback
        fn(this._ajaxCallback());
      }
    }
    return this;
  }

  /*=====  End of Public functions  ======*/

  /*=============================================
  =                Private functions            =
  =============================================*/

  /**
   * Call change callback
   * @param  {String} value - last added/deleted/selected value
   * @return
   */
  _triggerChange(value) {
    if (!value) return;

    triggerEvent(this.passedElement, 'change', {
      value
    });
  }

  /**
   * Process back space event
   * @param  {Array} activeItems items
   * @return
   */
  _handleBackspace(activeItems) {
    if (this.config.removeItems && activeItems) {
      const lastItem = activeItems[activeItems.length - 1];
      const hasHighlightedItems = activeItems.some((item) => item.highlighted === true);

      // If editing the last item is allowed and there are not other selected items,
      // we can edit the item value. Otherwise if we can remove items, remove all selected items
      if (this.config.editItems && !hasHighlightedItems && lastItem) {
        this.input.setValue(lastItem.value);
        this.input.setInputWidth();
        this._removeItem(lastItem);
        this._triggerChange(lastItem.value);
      } else {
        if (!hasHighlightedItems) {
          this.highlightItem(lastItem, false);
        }
        this.removeHighlightedItems(true);
      }
    }
  }

  /**
   * Validates whether an item can be added by a user
   * @param {Array} activeItems The currently active items
   * @param  {String} value     Value of item to add
   * @return {Object}           Response: Whether user can add item
   *                            Notice: Notice show in dropdown
   */
  _canAddItem(activeItems, value) {
    let canAddItem = true;
    let notice = isType('Function', this.config.addItemText) ? this.config.addItemText(value) : this.config.addItemText;

    if (this.passedElement.type === 'select-multiple' || this.passedElement.type === 'text') {
      if (this.config.maxItemCount > 0 && this.config.maxItemCount <= this.itemList.element.children.length) {
        // If there is a max entry limit and we have reached that limit
        // don't update
        canAddItem = false;
        notice = isType('Function', this.config.maxItemText) ? this.config.maxItemText(this.config.maxItemCount) : this.config.maxItemText;
      }
    }

    if (this.passedElement.type === 'text' && this.config.addItems) {
      const isUnique = !activeItems.some((item) => item.value === value.trim());

      // If a user has supplied a regular expression filter
      if (this.config.regexFilter) {
        // Determine whether we can update based on whether
        // our regular expression passes
        canAddItem = this._regexFilter(value);
      }

      // If no duplicates are allowed, and the value already exists
      // in the array
      if (this.config.duplicateItems === false && !isUnique) {
        canAddItem = false;
        notice = isType('Function', this.config.uniqueItemText) ? this.config.uniqueItemText(value) : this.config.uniqueItemText;
      }
    }

    return {
      response: canAddItem,
      notice,
    };
  }

  /**
   * Apply or remove a loading state to the component.
   * @param {Boolean} isLoading default value set to 'true'.
   * @return
   */
  _handleLoadingState(isLoading = true) {
    let placeholderItem = this.itemList.element.querySelector(`.${this.config.classNames.placeholder}`);

    if(isLoading) {
      this.container.startLoader();
      if (this.passedElement.type === 'select-one') {
        if (!placeholderItem) {
          placeholderItem = this._getTemplate('placeholder', this.config.loadingText);
          this.itemList.element.appendChild(placeholderItem);
        } else {
          placeholderItem.innerHTML = this.config.loadingText;
        }
      } else {
        this.input.element.placeholder = this.config.loadingText;
      }
    } else {
      // Remove loading states/text
      this.container.stopLoader();

      const placeholder = this.config.placeholder ?
        (this.config.placeholderValue || this.passedElement.getAttribute('placeholder')) : false;

      if (this.passedElement.type === 'select-one') {
        placeholderItem.innerHTML = placeholder || '';
      } else {
        this.input.element.placeholder = placeholder || '';
      }
    }
  }

  /**
   * Retrieve the callback used to populate component's choices in an async way.
   * @returns {Function} The callback as a function.
   */
  _ajaxCallback() {
    return (results, value, label) => {
      if (!results || !value) return;

      const parsedResults = isType('Object', results) ? [results] : results;

      if (parsedResults && isType('Array', parsedResults) && parsedResults.length) {
        // Remove loading states/text
        this._handleLoadingState(false);
        // Add each result as a choice
        parsedResults.forEach((result, index) => {
          const isSelected = result.selected ? result.selected : false;
          const isDisabled = result.disabled ? result.disabled : false;
          if (result.choices) {
            this._addGroup(result, (result.id || null), value, label);
          } else {
            this._addChoice(isSelected, isDisabled, result[value], result[label]);
          }
        });
      } else {
        // No results, remove loading state
        this._handleLoadingState(false);
      }
    };
  }

  /**
   * Filter choices based on search value
   * @param  {String} value Value to filter by
   * @return
   */
  _searchChoices(value) {
    const newValue = isType('String', value) ? value.trim() : value;
    const currentValue = isType('String', this.currentValue) ? this.currentValue.trim() : this.currentValue;

    // If new value matches the desired length and is not the same as the current value with a space
    if (newValue.length >= 1 && newValue !== `${currentValue} `) {
      const haystack = this.store.getChoicesFilteredBySelectable();
      const needle = newValue;
      const keys = isType('Array', this.config.sortFields) ? this.config.sortFields : [this.config.sortFields];
      const options = Object.assign(this.config.fuseOptions, { keys });
      const fuse = new Fuse(haystack, options);
      const results = fuse.search(needle);

      this.currentValue = newValue;
      this.highlightPosition = 0;
      this.isSearching = true;
      this.store.dispatch(filterChoices(results));
    }
  }

  /**
   * Determine the action when a user is searching
   * @param  {String} value Value entered by user
   * @return
   */
  _handleSearch(value) {
    if (!value) return;
    const choices = this.store.getChoices();
    const hasUnactiveChoices = choices.some((option) => option.active !== true);

    // Run callback if it is a function
    if (this.input.element === document.activeElement) {
      // Check that we have a value to search and the input was an alphanumeric character
      if (value && value.length > this.config.searchFloor) {
        // Filter available choices
        this._searchChoices(value);
        // Trigger search event
        triggerEvent(this.passedElement, 'search', {
          value,
        });
      } else if (hasUnactiveChoices) {
        // Otherwise reset choices to active
        this.isSearching = false;
        this.store.dispatch(activateChoices(true));
      }
    }
  }

  /**
   * Trigger event listeners
   * @return
   */
  _addEventListeners() {
    document.addEventListener('keyup', this._onKeyUp);
    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('click', this._onClick);
    document.addEventListener('touchmove', this._onTouchMove);
    document.addEventListener('touchend', this._onTouchEnd);
    document.addEventListener('mousedown', this._onMouseDown);
    document.addEventListener('mouseover', this._onMouseOver);

    if (this.passedElement.type && this.passedElement.type === 'select-one') {
      this.container.outer.addEventListener('focus', this._onFocus);
      this.container.outer.addEventListener('blur', this._onBlur);
    }

    this.input.element.addEventListener('input', this._onInput);
    this.input.element.addEventListener('paste', this._onPaste);
    this.input.element.addEventListener('focus', this._onFocus);
    this.input.element.addEventListener('blur', this._onBlur);
  }

  /**
   * Remove event listeners
   * @return
   */
  _removeEventListeners() {
    document.removeEventListener('keyup', this._onKeyUp);
    document.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('click', this._onClick);
    document.removeEventListener('touchmove', this._onTouchMove);
    document.removeEventListener('touchend', this._onTouchEnd);
    document.removeEventListener('mousedown', this._onMouseDown);
    document.removeEventListener('mouseover', this._onMouseOver);

    if (this.passedElement.type && this.passedElement.type === 'select-one') {
      this.container.outer.removeEventListener('focus', this._onFocus);
      this.container.outer.removeEventListener('blur', this._onBlur);
    }

    this.input.element.removeEventListener('input', this._onInput);
    this.input.element.removeEventListener('paste', this._onPaste);
    this.input.element.removeEventListener('focus', this._onFocus);
    this.input.element.removeEventListener('blur', this._onBlur);
  }

  _resetSearch() {
    if (this.passedElement.type !== 'text' && this.config.search) {
      this.isSearching = false;
      this.store.dispatch(activateChoices(true));
    }
  }

  /**
   * Key down event
   * @param  {Object} e Event
   * @return
   */
  _onKeyDown(e) {
    if (e.target !== this.input.element && !this.container.outer.contains(e.target)) {
      return;
    }

    const target = e.target;
    const passedElementType = this.passedElement.type;
    const activeItems = this.store.getItemsFilteredByActive();
    const hasFocusedInput = this.input.element === document.activeElement;
    const hasActiveDropdown = this.dropdown.active;
    const hasItems = this.itemList.element && this.itemList.element.children;
    const keyString = String.fromCharCode(e.keyCode);

    const backKey = 46;
    const deleteKey = 8;
    const enterKey = 13;
    const aKey = 65;
    const escapeKey = 27;
    const upKey = 38;
    const downKey = 40;
    const pageUpKey = 33;
    const pageDownKey = 34;
    const ctrlDownKey = e.ctrlKey || e.metaKey;

    // If a user is typing and the dropdown is not active
    if (passedElementType !== 'text' && /[a-zA-Z0-9-_ ]/.test(keyString) && !hasActiveDropdown) {
      this.dropdown.show(true);
    }

    this.canSearch = this.config.search;

    const onAKey = () => {
      // If CTRL + A or CMD + A have been pressed and there are items to select
      if (ctrlDownKey && hasItems) {
        this.canSearch = false;
        if (this.config.removeItems && !this.input.element.value && this.input.element === document.activeElement) {
          // Highlight items
          this.highlightAll(this.itemList.element.children);
        }
      }
    };

    const onEnterKey = () => {
      // If enter key is pressed and the input has a value
      if (passedElementType === 'text' && target.value) {
        const value = this.input.element.value;
        const canAddItem = this._canAddItem(activeItems, value);

        // All is good, add
        if (canAddItem.response) {
          if (hasActiveDropdown) {
            this.dropdown.hide();
          }
          this._addItem(value);
          this._triggerChange(value);
          this.input.clearInput();
          this._resetSearch();
        }
      }

      if (target.hasAttribute('data-button')) {
        this.itemList.handleButtonAction(activeItems, target);
        e.preventDefault();
      }

      if (hasActiveDropdown) {
        e.preventDefault();
        const highlighted = this.dropdown.getHighlighted();

        // If we have a highlighted choice
        if (highlighted) {
          this.choiceList.handleChoiceAction(activeItems, highlighted);
          this._resetSearch();
        }

      } else if (passedElementType === 'select-one') {
        // Open single select dropdown if it's not active
        if (!hasActiveDropdown) {
          this.dropdown.show(true);
          e.preventDefault();
        }
      }
    };

    const onEscapeKey = () => {
      if (hasActiveDropdown) {
        this.dropdown.toggle();
      }
    };

    const onDirectionKey = () => {
      // If up or down key is pressed, traverse through options
      if (hasActiveDropdown || passedElementType === 'select-one') {
        // Show dropdown if focus
        if (!hasActiveDropdown) {
          this.dropdown.show(true);
        }

        this.canSearch = false;

        const directionInt = e.keyCode === downKey || e.keyCode === pageDownKey ? 1 : -1;
        const skipKey = e.metaKey || e.keyCode === pageDownKey || e.keyCode === pageUpKey;

        let nextEl;
        if (skipKey) {
          if (directionInt > 0) {
            nextEl = Array.from(this.dropdown.element.querySelectorAll('[data-choice-selectable]')).pop();
          } else {
            nextEl = this.dropdown.element.querySelector('[data-choice-selectable]');
          }
        } else {
          const currentEl = this.dropdown.getHighlighted();
          if (currentEl) {
            nextEl = getAdjacentEl(currentEl, '[data-choice-selectable]', directionInt);
          } else {
            nextEl = this.dropdown.element.querySelector('[data-choice-selectable]');
          }
        }

        if (nextEl) {
          // We prevent default to stop the cursor moving
          // when pressing the arrow
          if (!isScrolledIntoView(nextEl, this.choiceList, directionInt)) {
            this.choiceList.scrollToChoice(nextEl, directionInt);
          }
          this.choiceList.highlightChoice(nextEl);
        }

        // Prevent default to maintain cursor position whilst
        // traversing dropdown options
        e.preventDefault();
      }
    };

    const onDeleteKey = () => {
      // If backspace or delete key is pressed and the input has no value
      if (hasFocusedInput && !e.target.value && passedElementType !== 'select-one') {
        this._handleBackspace(activeItems);
        e.preventDefault();
      }
    };

    // Map keys to key actions
    const keyDownActions = {
      [aKey]: onAKey,
      [enterKey]: onEnterKey,
      [escapeKey]: onEscapeKey,
      [upKey]: onDirectionKey,
      [pageUpKey]: onDirectionKey,
      [downKey]: onDirectionKey,
      [pageDownKey]: onDirectionKey,
      [deleteKey]: onDeleteKey,
      [backKey]: onDeleteKey,
    };

    // If keycode has a function, run it
    if (keyDownActions[e.keyCode]) {
      keyDownActions[e.keyCode]();
    }
  }

  /**
   * Key up event
   * @param  {Object} e Event
   * @return
   */
  _onKeyUp(e) {
    if (e.target !== this.input.element) {
      return;
    }

    // We are typing into a text input and have a value, we want to show a dropdown
    // notice. Otherwise hide the dropdown
    if (this.isTextElement) {
      const hasActiveDropdown = this.dropdown.active;
      const value = this.input.element.value;

      if (value) {
        const activeItems = this.store.getItemsFilteredByActive();
        const canAddItem = this._canAddItem(activeItems, value);

        if (canAddItem.notice) {
          const dropdownItem = this._getTemplate('notice', canAddItem.notice);
          this.dropdown.element.innerHTML = dropdownItem.outerHTML;
        }

        if (canAddItem.response === true) {
          if (!hasActiveDropdown) {
            this.dropdown.show();
          }
        } else if (!canAddItem.notice && hasActiveDropdown) {
          this.dropdown.hide();
        }
      } else if (hasActiveDropdown) {
        this.dropdown.hide();
      }
    } else {
      const backKey = 46;
      const deleteKey = 8;

      // If user has removed value...
      if ((e.keyCode === backKey || e.keyCode === deleteKey) && !e.target.value) {
        // ...and it is a multiple select input, activate choices (if searching)
        if (this.passedElement.type !== 'text' && this.isSearching) {
          this.isSearching = false;
          this.store.dispatch(activateChoices(true));
        }
      } else if (this.canSearch) {
        this._handleSearch(this.input.element.value);
      }
    }
  }

  /**
   * Input event
   * @param  {Object} e Event
   * @return
   */
  _onInput() {
    if (this.passedElement.type !== 'select-one') {
      this.input.setInputWidth();
    }
  }

  /**
   * Touch move event
   * @param  {Object} e Event
   * @return
   */
  _onTouchMove() {
    if (this.wasTap === true) {
      this.wasTap = false;
    }
  }

  /**
   * Touch end event
   * @param  {Object} e Event
   * @return
   */
  _onTouchEnd(e) {
    const target = e.target || e.touches[0].target;
    const hasActiveDropdown = this.dropdown.active;

    // If a user tapped within our container...
    if (this.wasTap === true && this.container.outer.contains(target)) {
      // ...and we aren't dealing with a single select box, show dropdown/focus input
      if (
          (target === this.container.outer || target === this.container.inner)
          && this.passedElement.type !== 'select-one'
        ) {
        if (this.isTextElement) {
          // If text element, we only want to focus the input (if it isn't already)
          if (document.activeElement !== this.input.element) {
            this.input.focus();
          }
        } else if (!hasActiveDropdown) {
          // If a select box, we want to show the dropdown
          this.dropdown.show(true);
        }
      }
      // Prevents focus event firing
      e.stopPropagation();
    }

    this.wasTap = true;
  }

  /**
   * Mouse down event
   * @param  {Object} e Event
   * @return
   */
  _onMouseDown(e) {
    const target = e.target;
    if (this.container.outer.contains(target) && target !== this.input.element) {
      const activeItems = this.store.getItemsFilteredByActive();
      const hasShiftKey = e.shiftKey;

      if (target.hasAttribute('data-item')) {
        this.itemList.handleItemAction(activeItems, target, hasShiftKey);
      } else if (target.hasAttribute('data-choice')) {
        this.choiceList.handleChoiceAction(activeItems, target);
        this._resetSearch();
      }

      e.preventDefault();
    }
  }

  /**
   * Click event
   * @param  {Object} e Event
   * @return
   */
  _onClick(e) {
    const target = e.target;
    const hasActiveDropdown = this.dropdown.active;
    const activeItems = this.store.getItemsFilteredByActive();

    // If target is something that concerns us
    if (this.container.outer.contains(target)) {
      // Handle button delete
      if (target.hasAttribute('data-button')) {
        this.itemList.handleButtonAction(activeItems, target);
      }

      if (!hasActiveDropdown) {
        if (this.isTextElement) {
          if (document.activeElement !== this.input.element) {
            this.input.focus();
          }
        } else {
          if (this.canSearch) {
            this.dropdown.show(true);
          } else {
            this.dropdown.show();
            this.container.outer.focus();
          }
        }
      } else if (
          this.passedElement.type === 'select-one'
          && target !== this.input.element
          && !this.dropdown.element.contains(target)
        ) {
        this.dropdown.hide(true);
      }
    } else {
      const hasHighlightedItems = activeItems.some((item) => item.highlighted === true);

      // De-select any highlighted items
      if (hasHighlightedItems) {
        this.unhighlightAll();
      }

      // Remove focus state
      this.container.blur();

      // Close all other dropdowns
      if (hasActiveDropdown) {
        this.dropdown.hide();
      }
    }
  }

  /**
   * Mouse over (hover) event
   * @param  {Object} e Event
   * @return
   */
  _onMouseOver(e) {
    // If the dropdown is either the target or one of its children is the target
    if (e.target === this.dropdown.element || this.dropdown.element.contains(e.target)) {
      if (e.target.hasAttribute('data-choice')) {
        this.choiceList.highlightChoice(e.target);
      }
    }
  }

  /**
   * Paste event
   * @param  {Object} e Event
   * @return
   */
  _onPaste(e) {
    // Disable pasting into the input if option has been set
    if (e.target === this.input.element && !this.config.paste) {
      e.preventDefault();
    }
  }

  /**
   * Focus event
   * @param  {Object} e Event
   * @return
   */
  _onFocus(e) {
    const target = e.target;
    // If target is something that concerns us
    if (this.container.outer.contains(target)) {
      const hasActiveDropdown = this.dropdown.active;
      const focusActions = {
        text: () => {
          if (target === this.input.element) {
            this.container.focus();
          }
        },
        'select-one': () => {
          this.container.focus();
          if (target === this.input.element) {
            // Show dropdown if it isn't already showing
            if (!hasActiveDropdown) {
              this.dropdown.show();
            }
          }
        },
        'select-multiple': () => {
          if (target === this.input.element) {
            // If element is a select box, the focussed element is the container and the dropdown
            // isn't already open, focus and show dropdown
            this.container.focus();

            if (!hasActiveDropdown) {
              this.dropdown.show(true);
            }
          }
        },
      };

      focusActions[this.passedElement.type]();
    }
  }

  /**
   * Blur event
   * @param  {Object} e Event
   * @return
   */
  _onBlur(e) {
    const target = e.target;
    // If target is something that concerns us
    if (this.container.outer.contains(target)) {
      const activeItems = this.store.getItemsFilteredByActive();
      const hasActiveDropdown = this.dropdown.active;
      const hasHighlightedItems = activeItems.some((item) => item.highlighted === true);
      const blurActions = {
        text: () => {
          if (target === this.input.element) {
            // Remove the focus state
            this.container.blur();
            // De-select any highlighted items
            if (hasHighlightedItems) {
              this.unhighlightAll();
            }
            // Hide dropdown if it is showing
            if (hasActiveDropdown) {
              this.dropdown.hide();
            }
          }
        },
        'select-one': () => {
          this.container.blur();
          if (target === this.container.outer) {
            // Hide dropdown if it is showing
            if (hasActiveDropdown && !this.canSearch) {
              this.dropdown.hide();
            }
          }

          if (target === this.input.element) {
            // Hide dropdown if it is showing
            if (hasActiveDropdown) {
              this.dropdown.hide();
            }
          }
        },
        'select-multiple': () => {
          if (target === this.input.element) {
            // Remove the focus state
            this.container.blur();
            if (hasActiveDropdown) {
              this.dropdown.hide();
            }
            // De-select any highlighted items
            if (hasHighlightedItems) {
              this.unhighlightAll();
            }
          }
        },
      };

      blurActions[this.passedElement.type]();
    }
  }

  /**
   * Tests value against a regular expression
   * @param  {string} value   Value to test
   * @return {Boolean}        Whether test passed/failed
   */
  _regexFilter(value) {
    if (!value) return;
    const regex = this.config.regexFilter;
    const expression = new RegExp(regex.source, 'i');
    return expression.test(value);
  }

  /**
   * Add item to store with correct value
   * @param {String} value Value to add to store
   * @param {String} label Label to add to store
   * @return {Object} Class instance
   */
  _addItem(value, label, choiceId = -1, groupId = -1) {
    let passedValue = isType('String', value) ? value.trim() : value;
    const items = this.store.getItems();
    const passedLabel = label || passedValue;
    const passedOptionId = parseInt(choiceId, 10) || -1;

    // Get group if group ID passed
    const group = groupId >= 0 ? this.store.getGroupById(groupId) : null;

    // Generate unique id
    const id = items ? items.length + 1 : 1;

    // If a prepended value has been passed, prepend it
    if (this.config.prependValue) {
      passedValue = this.config.prependValue + passedValue.toString();
    }

    // If an appended value has been passed, append it
    if (this.config.appendValue) {
      passedValue += this.config.appendValue.toString();
    }

    this.store.dispatch(addItem(passedValue, passedLabel, id, passedOptionId, groupId));

    if (this.passedElement.type === 'select-one') {
      this.removeActiveItems(id);
    }

    // Trigger change event
    if(group && group.value) {
      triggerEvent(this.passedElement, 'addItem', {
        id,
        value: passedValue,
        label: passedLabel,
        groupValue: group.value,
      });
    } else {
      triggerEvent(this.passedElement, 'addItem', {
        id,
        value: passedValue,
        label: passedLabel,
      });
    }

    return this;
  }

  /**
   * Remove item from store
   * @param {Object} item Item to remove
   * @param {Function} callback Callback to trigger
   * @return {Object} Class instance
   */
  _removeItem(item) {
    if (!item || !isType('Object', item)) {
      console.error('removeItem: No item object was passed to be removed');
      return;
    }

    const id = item.id;
    const value = item.value;
    const label = item.label;
    const choiceId = item.choiceId;
    const groupId = item.groupId;
    const group = groupId >= 0 ? this.store.getGroupById(groupId) : null;

    this.store.dispatch(removeItem(id, choiceId));

    if(group && group.value) {
      triggerEvent(this.passedElement, 'removeItem', {
        id,
        value,
        label,
        groupValue: group.value,
      });
    } else {
      triggerEvent(this.passedElement, 'removeItem', {
        id,
        value,
        label,
      });
    }

    return this;
  }

  /**
   * Add choice to dropdown
   * @param {Boolean} isSelected Whether choice is selected
   * @param {Boolean} isDisabled Whether choice is disabled
   * @param {String} value Value of choice
   * @param {String} Label Label of choice
   * @param {Number} groupId ID of group choice is within. Negative number indicates no group
   * @return
   */
  _addChoice(isSelected, isDisabled, value, label, groupId = -1) {
    if (typeof value === 'undefined' || value === null) return;

    // Generate unique id
    const choices = this.store.getChoices();
    const choiceLabel = label || value;
    const choiceId = choices ? choices.length + 1 : 1;

    this.store.dispatch(addChoice(value, choiceLabel, choiceId, groupId, isDisabled));

    if (isSelected) {
      this._addItem(value, choiceLabel, choiceId);
    }
  }

  /**
   * Clear all choices added to the store.
   * @return
   */
  _clearChoices() {
    this.store.dispatch(clearChoices());
  }

  /**
   * Add group to dropdown
   * @param {Object} group Group to add
   * @param {Number} id Group ID
   * @param {String} [valueKey] name of the value property on the object
   * @param {String} [labelKey] name of the label property on the object
   * @return
   */
  _addGroup(group, id, valueKey = 'value', labelKey = 'label') {
    const groupChoices = isType('Object', group) ? group.choices : Array.from(group.getElementsByTagName('OPTION'));
    const groupId = id ? id : Math.floor(new Date().valueOf() * Math.random());
    const isDisabled = group.disabled ? group.disabled : false;

    if (groupChoices) {
      this.store.dispatch(addGroup(group.label, groupId, true, isDisabled));

      groupChoices.forEach((option) => {
        const isOptDisabled = (option.disabled || (option.parentNode && option.parentNode.disabled)) || false;
        const isOptSelected = option.selected ? option.selected : false;
        let label;

        if (isType('Object', option)) {
          label = option[labelKey] || option[valueKey];
        } else {
          label = option.innerHTML;
        }

        this._addChoice(isOptSelected, isOptDisabled, option[valueKey], label, groupId);
      });
    } else {
      this.store.dispatch(addGroup(group.label, group.id, false, group.disabled));
    }
  }

  /**
   * Get template from name
   * @param  {String}    template Name of template to get
   * @param  {...}       args     Data to pass to template
   * @return {HTMLElement}        Template
   */
  _getTemplate(template, ...args) {
    if (!template) return;
    const templates = this.config.templates;
    return templates[template](...args);
  }

  /**
   * Create HTML element based on type and arguments
   * @return
   */
  _createTemplates() {
    const classNames = this.config.classNames;
    const templates = {
      containerOuter: (direction) => {
        return strToEl(`
          <div
            class="${classNames.containerOuter}"
            data-type="${this.passedElement.type}"
            ${this.passedElement.type === 'select-one' ? 'tabindex="0"' : ''}
            aria-haspopup="true"
            aria-expanded="false"
            dir="${direction}"
            >
            </div>
        `);
      },
      containerInner: () => {
        return strToEl(`
          <div class="${classNames.containerInner}"></div>
        `);
      },
      itemList: () => {
        return strToEl(`
          <div class="${classNames.list} ${this.passedElement.type === 'select-one' ? classNames.listSingle : classNames.listItems}"></div>
        `);
      },
      placeholder: (value) => {
        return strToEl(`
          <div class="${classNames.placeholder}">${value}</div>
        `);
      },
      item: (data) => {
        if (this.config.removeItemButton) {
          return strToEl(`
            <div
              class="${classNames.item} ${data.highlighted ? classNames.highlightedState : ''} ${!data.disabled ? classNames.itemSelectable : ''}"
              data-item
              data-id="${data.id}"
              data-value="${data.value}"
              ${data.active ? 'aria-selected="true"' : ''}
              ${data.disabled ? 'aria-disabled="true"' : ''}
              data-deletable
              >
              ${data.label}<button type="button" class="${classNames.button}" data-button>Remove item</button>
            </div>
          `);
        }
        return strToEl(`
          <div
            class="${classNames.item} ${data.highlighted ? classNames.highlightedState : classNames.itemSelectable}"
            data-item
            data-id="${data.id}"
            data-value="${data.value}"
            ${data.active ? 'aria-selected="true"' : ''}
            ${data.disabled ? 'aria-disabled="true"' : ''}\
            >
            ${data.label}
          </div>
        `);
      },
      choiceList: () => {
        return strToEl(`
          <div
            class="${classNames.list}"
            dir="ltr"
            role="listbox"
            ${this.passedElement.type !== 'select-one' ? 'aria-multiselectable="true"' : ''}
            >
          </div>
        `);
      },
      choiceGroup: (data) => {
        return strToEl(`
          <div
            class="${classNames.group} ${data.disabled ? classNames.itemDisabled : ''}"
            data-group
            data-id="${data.id}"
            data-value="${data.value}"
            role="group"
            ${data.disabled ? 'aria-disabled="true"' : ''}
            >
            <div class="${classNames.groupHeading}">${data.value}</div>
          </div>
        `);
      },
      choice: (data) => {
        return strToEl(`
          <div
            class="${classNames.item} ${classNames.itemChoice} ${data.disabled ? classNames.itemDisabled : classNames.itemSelectable}"
            data-select-text="${this.config.itemSelectText}"
            data-choice
            ${data.disabled ? 'data-choice-disabled aria-disabled="true"' : 'data-choice-selectable'}
            data-id="${data.id}"
            data-value="${data.value}"
            ${data.groupId > 0 ? 'role="treeitem"' : 'role="option"'}
            >
            ${data.label}
          </div>
        `);
      },
      input: () => {
        return strToEl(`
          <input
            type="text"
            class="${classNames.input} ${classNames.inputCloned}"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            role="textbox"
            aria-autocomplete="list"
            >
        `);
      },
      dropdown: () => {
        return strToEl(`
          <div
            class="${classNames.list} ${classNames.listDropdown}"
            aria-expanded="false"
            >
          </div>
        `);
      },
      notice: (label) => {
        return strToEl(`
          <div class="${classNames.item} ${classNames.itemChoice}">${label}</div>
        `);
      },
      option: (data) => {
        return strToEl(`
          <option value="${data.value}" selected>${data.label}</option>
        `);
      },
    };

    // User's custom templates
    const callbackTemplate = this.config.callbackOnCreateTemplates;
    let userTemplates = {};
    if (callbackTemplate && isType('Function', callbackTemplate)) {
      userTemplates = callbackTemplate.call(this, strToEl);
    }

    this.config.templates = extend(templates, userTemplates);
  }

  /**
   * Create DOM structure around passed select element
   * @return
   */
  _createInput() {
    const direction = this.passedElement.getAttribute('dir') || 'ltr';
    const containerOuter = this._getTemplate('containerOuter', direction);
    const containerInner = this._getTemplate('containerInner');
    const itemList = this._getTemplate('itemList');
    const choiceList = this._getTemplate('choiceList');
    const input = this._getTemplate('input');
    const dropdown = this._getTemplate('dropdown');
    const placeholder = this.config.placeholder ? this.config.placeholderValue || this.passedElement.getAttribute('placeholder') : false;

    this.input = new Input(input, this);
    this.itemList = new ItemList(itemList, this);
    this.choiceList = new ChoiceList(choiceList, this);
    this.container = new Container(containerOuter, containerInner, this);
    this.dropdown = new Dropdown(dropdown, this);

    // Hide passed input
    this.passedElement.classList.add(
      this.config.classNames.input,
      this.config.classNames.hiddenState
    );

    this.passedElement.tabIndex = '-1';
    this.passedElement.setAttribute('style', 'display:none;');
    this.passedElement.setAttribute('aria-hidden', 'true');
    this.passedElement.setAttribute('data-choice', 'active');

    // Wrap input in container preserving DOM ordering
    wrap(this.passedElement, this.container.inner);

    // Wrapper inner container with outer container
    wrap(this.container.inner, this.container.outer);

    // If placeholder has been enabled and we have a value
    if (placeholder) {
      input.placeholder = placeholder;
      if (this.passedElement.type !== 'select-one') {
        input.style.width = getWidthOfInput(input);
      }
    }

    if (!this.config.addItems) {
      this.disable();
    }

    this.container.outer.appendChild(this.container.inner);
    this.container.outer.appendChild(this.dropdown.element);
    this.container.inner.appendChild(this.itemList.element);

    if (this.passedElement.type !== 'text') {
      this.dropdown.element.appendChild(choiceList);
    }

    if (this.passedElement.type === 'select-multiple' || this.passedElement.type === 'text') {
      this.container.inner.appendChild(input);
    } else if (this.canSearch) {
      this.dropdown.element.insertBefore(input, this.dropdown.element.firstChild);
    }

    if (this.passedElement.type === 'select-multiple' || this.passedElement.type === 'select-one') {
      const passedGroups = Array.from(this.passedElement.getElementsByTagName('OPTGROUP'));

      this.highlightPosition = 0;
      this.isSearching = false;

      if (passedGroups && passedGroups.length) {
        passedGroups.forEach((group) => {
          this._addGroup(group, (group.id || null));
        });
      } else {
        const passedOptions = Array.from(this.passedElement.options);
        const filter = this.config.sortFilter;
        const allChoices = this.presetChoices;

        // Create array of options from option elements
        passedOptions.forEach((o) => {
          allChoices.push({
            value: o.value,
            label: o.innerHTML,
            selected: o.selected,
            disabled: (o.disabled || o.parentNode.disabled),
          });
        });

        // If sorting is enabled or the user is searching, filter choices
        if (this.config.shouldSort) {
          allChoices.sort(filter);
        }

        // Determine whether there is a selected choice
        const hasSelectedChoice = allChoices.some((choice) => {
          return choice.selected === true;
        });

        // Add each choice
        allChoices.forEach((choice, index) => {
          const isDisabled = choice.disabled ? choice.disabled : false;
          const isSelected = choice.selected ? choice.selected : false;
          // Pre-select first choice if it's a single select
          if (this.passedElement.type === 'select-one') {
            if (hasSelectedChoice || (!hasSelectedChoice && index > 0)) {
              // If there is a selected choice already or the choice is not
              // the first in the array, add each choice normally
              this._addChoice(isSelected, isDisabled, choice.value, choice.label);
            } else {
              // Otherwise pre-select the first choice in the array
              this._addChoice(true, false, choice.value, choice.label);
            }
          } else {
            this._addChoice(isSelected, isDisabled, choice.value, choice.label);
          }
        });
      }
    } else if (this.isTextElement) {
      // Add any preset values seperated by delimiter
      this.presetItems.forEach((item) => {
        const itemType = getType(item);
        if (itemType === 'Object') {
          if (!item.value) return;
          this._addItem(item.value, item.label, item.id);
        } else if (itemType === 'String') {
          this._addItem(item);
        }
      });
    }
  }

  /*=====  End of Private functions  ======*/
}

module.exports = Choices;
