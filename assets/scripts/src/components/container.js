export default class Container {
  constructor(outerElement, innerElement, instance) {
    this.outer = outerElement;
    this.inner = innerElement;
    this.instance = instance;
    this.classNames = instance.config.classNames;
    this.disabled = false;
    this.flipped = false;
    this.focussed = false;
    this.expanded = false;
    this.loading = false;
  }

  /**
   * Set element focus state
   * @return
   */
  focus() {
    this.focussed = true;
    this.outer.classList.add(this.classNames.focusState);
  }

  /**
   * Remove element focus state
   * @return
   */
  blur() {
    this.focussed = false;
    this.outer.classList.remove(this.classNames.focusState);
  }

  /**
   * Set element flip state
   * @return
   */
  flip() {
    this.flipped = true;
    this.outer.classList.add(this.classNames.flippedState);
  }

  /**
   * Remove element flip state
   * @return
   */
  unflip() {
    this.flipped = false;
    this.outer.classList.remove(this.classNames.flippedState);
  }

  /**
   * Set element expand state
   * @return
   */
  expand() {
    this.expanded = true;
    this.outer.classList.add(this.classNames.openState);
    this.outer.setAttribute('aria-expanded', 'true');
  }

  /**
   * Remove element expand state
   * @return
   */
  contract() {
    this.expanded = false;
    this.outer.classList.remove(this.classNames.openState);
    this.outer.setAttribute('aria-expanded', 'false');
  }

  /**
   * Enable element
   * @return
   */
  enable() {
    this.disabled = false;
    this.outer.classList.remove(this.classNames.disabledState);
    this.outer.removeAttribute('aria-disabled');
  }

  /**
   * Disable element
   * @return
   */
  disable() {
    this.disabled = true;
    this.outer.classList.add(this.classNames.disabledState);
    this.outer.setAttribute('aria-disabled', 'true');
  }

  /**
   * Set loading state
   * @return
   */
  startLoader() {
    this.loading = true;
    this.outer.classList.add(this.classNames.loadingState);
    this.outer.setAttribute('aria-busy', 'true');
  }

  /**
   * Remove loading state
   * @return
   */
  stopLoader() {
    this.loading = false;
    this.outer.classList.remove(this.classNames.loadingState);
    this.outer.removeAttribute('aria-busy');
  }
}
