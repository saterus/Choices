import { triggerEvent } from './../lib/utils.js';

export default class Dropdown {
  constructor(element, instance) {
    this.element = element;
    this.instance = instance;
    this.position = instance.config.position;
    this.classNames = instance.config.classNames;
    this.active = false;
    this.flipped = false;
  }

  /**
   * Show dropdown to user by adding active state class
   * @return {Object} Class instance
   */
  show(focusInput = false) {
    const body = document.body;
    const html = document.documentElement;
    const winHeight = Math.max(
        body.scrollHeight,
        body.offsetHeight,
        html.clientHeight,
        html.scrollHeight,
        html.offsetHeight
      );

    this.instance.container.expand();
    this.element.classList.add(this.classNames.activeState);
    this.active = true;

    const dimensions = this.element.getBoundingClientRect();
    const dropdownPos = Math.ceil(dimensions.top + window.scrollY + dimensions.height);

    // If flip is enabled and the dropdown bottom position is greater than the window height flip the dropdown.
    let shouldFlip = false;
    if (this.position === 'auto') {
      shouldFlip = dropdownPos >= winHeight;
    } else if (this.position === 'top') {
      shouldFlip = true;
    }

    if (shouldFlip) {
      this.instance.container.flip();
      this.flipped = true;
    } else {
      this.instance.container.unflip();
      this.flipped = false;
    }

    // Optionally focus the input if we have a search input
    if (focusInput && this.canSearch && document.activeElement !== this.input) {
      this.instance.input.focus();
    }

    triggerEvent(this.instance.passedElement, 'showDropdown', {});

    return this.instance;
  }

  /**
   * Hide dropdown from user
   * @return {Object} Class instance
   */
  hide(blurInput = false) {
    // A dropdown flips if it does not have space within the page
    const isFlipped = this.flipped;

    this.instance.container.contract();
    this.element.classList.remove(this.classNames.activeState);
    this.active = false;

    if (isFlipped) {
      this.instance.container.unflip();
      this.flipped = false;
    }

    // Optionally blur the input if we have a search input
    if (blurInput && this.canSearch && document.activeElement === this.input) {
      this.instance.input.blur();
    }

    triggerEvent(this.instance.passedElement, 'hideDropdown', {});

    return this.instance;
  }

  /**
   * Determine whether to hide or show dropdown based on its current state
   * @return {Object} Class instance
   */
  toggle() {
    if (this.active) {
      this.hide();
    } else {
      this.show(true);
    }

    return this.instance;
  }

  /**
   * Get highlighted item
   * @return {NodeList}
   */
  getHighlighted() {
    return this.element.querySelector(`.${this.classNames.highlightedState}`);
  }
}
