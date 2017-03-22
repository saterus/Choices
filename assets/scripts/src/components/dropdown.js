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
   * @public
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

    this.instance.containerOuter.classList.add(this.classNames.openState);
    this.instance.containerOuter.setAttribute('aria-expanded', 'true');
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
      this.instance.containerOuter.classList.add(this.classNames.flippedState);
      this.flipped = true;
    } else {
      this.instance.containerOuter.classList.remove(this.classNames.flippedState);
      this.flipped = false;
    }

    // Optionally focus the input if we have a search input
    if (focusInput && this.canSearch && document.activeElement !== this.input) {
      this.instance.input.focus();
    }

    triggerEvent(this.instance.passedElement, 'showDropdown', {});

    return this;
  }

  /**
   * Hide dropdown from user
   * @return {Object} Class instance
   * @public
   */
  hide(blurInput = false) {
    // A dropdown flips if it does not have space within the page
    const isFlipped = this.flipped;

    this.instance.containerOuter.classList.remove(this.classNames.openState);
    this.instance.containerOuter.setAttribute('aria-expanded', 'false');
    this.element.classList.remove(this.classNames.activeState);
    this.active = false;

    if (isFlipped) {
      this.instance.containerOuter.classList.remove(this.classNames.flippedState);
      this.flipped = false;
    }

    // Optionally blur the input if we have a search input
    if (blurInput && this.canSearch && document.activeElement === this.input) {
      this.instance.input.blur();
    }

    triggerEvent(this.instance.passedElement, 'hideDropdown', {});

    return this;
  }

  /**
   * Determine whether to hide or show dropdown based on its current state
   * @return {Object} Class instance
   * @public
   */
  toggle() {
    if (this.active) {
      this.hide();
    } else {
      this.show(true);
    }
    return this;
  }

  getHighlighted() {
    return this.element.querySelector(`.${this.classNames.highlightedState}`);
  }
}
