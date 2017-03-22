import { getWidthOfInput } from './../lib/utils.js';

export default class Input {
  constructor(element, instance) {
    this.element = element;
    this.instance = instance;
    this.classNames = instance.config.classNames;
  }

  /**
   * Clear element value
   * @return
   */
  clearValue() {
    if (this.element.value) {
      this.setValue('');
    }
  }

  /**
   * Set element value
   * @param {String} value Value to set
   * @return
   */
  setValue(value) {
    this.element.value = value;
  }

  /**
   * Focus element
   * @return
   */
  focus() {
    this.element.focus();
  }

  /**
   * Remove element disabled attribute
   * @return
   */
  enable() {
    this.element.removeAttribute('disabled');
  }

  /**
   * Set element disabled attribute
   * @return
   */
  disable() {
    this.element.setAttribute('disabled', '');
  }

  /**
   * Set the correct input width based on placeholder
   * value or input value
   * @return
   */
  setInputWidth() {
    if (
      this.instance.config.placeholder &&
      (this.instance.config.placeholderValue || this.instance.passedElement.getAttribute('placeholder'))
    ) {
      // If there is a placeholder, we only want to set the width of the input when it is a greater
      // length than 75% of the placeholder. This stops the input jumping around.
      const placeholder = this.instance.config.placeholder ? this.instance.config.placeholderValue ||
        this.instance.passedElement.getAttribute('placeholder') : false;
      if (this.element.value && this.element.value.length >= (placeholder.length / 1.25)) {
        this.element.style.width = getWidthOfInput(this.element);
      }
    } else {
      // If there is no placeholder, resize input to contents
      this.element.style.width = getWidthOfInput(this.element);
    }
  }

  /**
   * Set value of input to blank
   * @return {Object} Class instance
   */
  clearInput() {
    this.clearValue();

    if (this.instance.passedElement.type !== 'select-one') {
      this.setInputWidth();
    }

    return this.instance;
  }
}
