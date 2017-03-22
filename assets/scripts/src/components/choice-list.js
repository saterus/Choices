export default class ChoiceList {
  constructor(element, instance) {
    this.element = element;
    this.instance = instance;
    this.classNames = instance.config.classNames;
  }

  /**
   * Reset element scroll position
   * @return
   */
  resetScrollPosition() {
    this.element.scrollTop = 0;
  }

  /**
   * Clear element inner HTML
   * @return
   */
  clear() {
    this.element.innerHTML = '';
  }

  /**
   * Scroll to an option element
   * @param  {HTMLElement} option  Option to scroll to
   * @param  {Number} direction  Whether option is above or below
   * @return
   */
  scrollToChoice(choice, direction) {
    if (!choice) {
      return;
    }

    const dropdownHeight = this.element.offsetHeight;
    const choiceHeight = choice.offsetHeight;
    // Distance from bottom of element to top of parent
    const choicePos = choice.offsetTop + choiceHeight;
    // Scroll position of dropdown
    const containerScrollPos = this.element.scrollTop + dropdownHeight;
    // Difference between the choice and scroll position
    const endPoint = direction > 0 ? ((this.element.scrollTop + choicePos) - containerScrollPos) : choice.offsetTop;

    const animateScroll = () => {
      const strength = 4;
      const choiceListScrollTop = this.element.scrollTop;
      let continueAnimation = false;
      let easing;
      let distance;

      if (direction > 0) {
        easing = (endPoint - choiceListScrollTop) / strength;
        distance = easing > 1 ? easing : 1;

        this.element.scrollTop = choiceListScrollTop + distance;
        if (choiceListScrollTop < endPoint) {
          continueAnimation = true;
        }
      } else {
        easing = (choiceListScrollTop - endPoint) / strength;
        distance = easing > 1 ? easing : 1;

        this.element.scrollTop = choiceListScrollTop - distance;
        if (choiceListScrollTop > endPoint) {
          continueAnimation = true;
        }
      }

      if (continueAnimation) {
        requestAnimationFrame((time) => {
          animateScroll(time, endPoint, direction);
        });
      }
    };

    requestAnimationFrame((time) => {
      animateScroll(time, endPoint, direction);
    });
  }

  /**
   * Highlight choice
   * @param  {HTMLElement} el Element to highlight
   * @return
   */
  highlightChoice(el) {
    // Highlight first element in dropdown
    const choices = Array.from(this.instance.dropdown.element.querySelectorAll('[data-choice-selectable]'));

    if (choices && choices.length) {
      const highlightedChoices = Array.from(this.instance.dropdown.element.querySelectorAll(`.${this.classNames.highlightedState}`));

      // Remove any highlighted choices
      highlightedChoices.forEach((choice) => {
        choice.classList.remove(this.classNames.highlightedState);
        choice.setAttribute('aria-selected', 'false');
      });

      if (el) {
        // Highlight given option
        el.classList.add(this.classNames.highlightedState);
        this.instance.highlightPosition = choices.indexOf(el);
      } else {
        // Highlight choice based on last known highlight location
        let choice;

        if (choices.length > this.instance.highlightPosition) {
          // If we have an option to highlight
          choice = choices[this.instance.highlightPosition];
        } else {
          // Otherwise highlight the option before
          choice = choices[choices.length - 1];
        }

        if (!choice) {
          choice = choices[0];
        }
        choice.classList.add(this.classNames.highlightedState);
        choice.setAttribute('aria-selected', 'true');
      }
    }
  }

  /**
   * Process click of a choice
   * @param {Array}   activeItems The currently active items
   * @param {Element} element     Choice being interacted with
   * @return
   */
  handleChoiceAction(activeItems, element) {
    if (!activeItems || !element) {
      return;
    }

    // If we are clicking on an option
    const id = element.getAttribute('data-id');
    const choice = this.instance.store.getChoiceById(id);
    const hasActiveDropdown = this.instance.dropdown.active;

    if (choice && !choice.selected && !choice.disabled) {
      const canAddItem = this.instance._canAddItem(activeItems, choice.value);

      if (canAddItem.response) {
        this.instance._addItem(choice.value, choice.label, choice.id, choice.groupId);
        this.instance._triggerChange(choice.value);
      }
    }

    this.instance.input.clearInput(this.instance.passedElement);

    // We want to close the dropdown if we are dealing with a single select box
    if (hasActiveDropdown && this.instance.passedElement.type === 'select-one') {
      this.instance.dropdown.hide();
      this.instance.container.outer.focus();
    }
  }

}
