const Frameable = {};
Frameable.activeContentWindows = [];
Frameable.activeResizers = [];
Frameable.currentResizer = null;
Frameable.parentContainer = null;

Frameable.Sides = {
  TOP: "TOP",
  BOTTOM: "BOTTOM",
  LEFT: "LEFT",
  RIGHT: "RIGHT"
};

Frameable.Classes = {
  WINDOW_TOP: "frameable-top",
  WINDOW_BOTTOM: "frameable-bottom",
  WINDOW_LEFT: "frameable-left",
  WINDOW_RIGHT: "frameable-right"
};

Frameable.initialise = function (containerId, framesConfig, resizerConfig = {}) {
  if ('highlightThickness' in resizerConfig)
    document.documentElement.style.setProperty(
      '--frameable-resizer-highlight-size',
      `${resizerConfig.highlightThickness}px`
    );
  if ('thickness' in resizerConfig) {
    document.documentElement.style.setProperty('--frameable-resizer-size', `${resizerConfig.thickness}px`);
    Frameable.resizerThickness = resizerConfig.thickness;
  } else {
    let size = getComputedStyle(document.documentElement).getPropertyValue('--frameable-resizer-size');
    Frameable.resizerThickness = parseInt(size.replace('px', ''), 10);
  }
  Frameable.parentContainer = document.getElementById(containerId).parentElement;
  Frameable.parentContainer.style.position = 'relative';
  let container = document.getElementById(containerId);
  container.style.width = Frameable.parentContainer.clientWidth + "px";
  container.style.height = Frameable.parentContainer.clientHeight + "px";
  let containerWindow = new Frameable.ContentWindow(
    null,
    parseInt(container.style.width, 10),
    parseInt(container.style.height, 10),
    container
  );
  Frameable.activeContentWindows.push(containerWindow);
  Frameable.generateFrames(container, framesConfig);
  Frameable.setupChildren(containerWindow);
  window.addEventListener("resize", () => {
    Frameable.activeContentWindows[0].changeSize(
      Frameable.parentContainer.clientWidth,
      Frameable.parentContainer.clientHeight
    );
    Frameable.activeContentWindows[0].childrenResize();
  });
};

Frameable.generateFrames = function (parent, framesConfig) {
  for (let i = 0; i < framesConfig.length; i++) {
    let node = document.createElement("div");
    node.classList.add(framesConfig[i].position);
    if ('url' in framesConfig[i]) {
      let iframe = document.createElement("iframe");
      iframe.src = framesConfig[i].url;
      if ('data', framesConfig[i]) iframe.setAttribute('data', framesConfig[i].data);
      node.appendChild(iframe);
    }
    if ('size' in framesConfig[i]) node.setAttribute('size', framesConfig[i].size);
    parent.appendChild(node);
    if ('children' in framesConfig[i]) Frameable.generateFrames(node, framesConfig[i].children);
  }
}

Frameable.setupChildren = function (containerWindow) {
  let childInfo = containerWindow.findChildWindowElements();
  if (childInfo.child1 == null) return;

  let sizeFraction = 0.5;
  if (childInfo.child1.hasAttribute('size')) {
    let size = childInfo.child1.getAttribute('size');
    if (size.includes(',')) size = size.replace(',', '.');
    sizeFraction = parseFloat(size);
  }
  if (childInfo.isHorizontal)
    containerWindow.splitHorizontally(sizeFraction, childInfo.child1, childInfo.child2);
  else
    containerWindow.splitVertically(sizeFraction, childInfo.child1, childInfo.child2);
  // Set up the children of the newly created windows
  let childWindow1 = Frameable.activeContentWindows[Frameable.activeContentWindows.length - 2];
  let childWindow2 = Frameable.activeContentWindows[Frameable.activeContentWindows.length - 1];
  Frameable.setupChildren(childWindow1);
  Frameable.setupChildren(childWindow2);
};

Frameable.ContentWindow = class {

  constructor(container, width, height, div) {
    this.container = container;
    this.width = width;
    this.height = height;
    this.sizeFractionOfContainer = 0.5;

    if (div == null) {
      this.divId = "frameable-id-" + Frameable.activeContentWindows.length;

      let div = document.createElement('iframe');
      div.id = this.divId;
      div.classList.add('frameable-cw');

      // Insert the div with correct ID into the container window; or body if container is null
      if (container != null) container.getDiv().appendChild(div);
      else document.body.insertAdjacentHTML('afterbegin', htmlToAdd);
    } else {
      if (div.id == "")
        div.id = "frameable-id-" + Frameable.activeContentWindows.length;
      this.divId = div.id;
      this.getDiv().classList.add("frameable-cw");
    }

    let divElement = this.getDiv();

    this.children = [];
    this.isSplitHorizontally = false;
    this.isSplitVertically = false;
    this.childResizer = null;
    this.minWidth = 10;
    this.minHeight = 10;
    this.originalMinSize = 10;
    this.childResizerThickness = Frameable.resizerThickness;

    divElement.style.width = Math.round(this.width) + "px";
    divElement.style.height = Math.round(this.height) + "px";

    Frameable.activeContentWindows.push(this);
    this.calculateSizeFractionOfcontainer();
  }

  getDiv() {
    return document.getElementById(this.divId);
  }

  getDivId() {
    return this.divId;
  }

  findChildWindowElements() {
    // Cannot have more than two direct children
    let child1, child2, isHorizontal = false;
    // Find left child
    if (document.querySelectorAll(`#${this.divId} > .${Frameable.Classes.WINDOW_LEFT}`).length > 0) {
      child1 = document.querySelectorAll(`#${this.divId} > .${Frameable.Classes.WINDOW_LEFT}`)[0];
      if (document.querySelectorAll(`#${this.divId} > .${Frameable.Classes.WINDOW_LEFT}`).length > 0) {
        child2 = document.querySelectorAll(`#${this.divId} > .${Frameable.Classes.WINDOW_RIGHT}`)[0];
      } else {
        console.error(`${this.divId} has left child but not right`);
      }
      isHorizontal = true;
    }
    if (document.querySelectorAll(`#${this.divId} > .${Frameable.Classes.WINDOW_TOP}`).length > 0) {
      if (child1 != undefined) {
        console.error(`${this.divId} has both left and top children`);
        return;
      } else {
        child1 = document.querySelectorAll(`#${this.divId} > .${Frameable.Classes.WINDOW_TOP}`)[0];
        if (document.querySelectorAll(`#${this.divId} > .${Frameable.Classes.WINDOW_BOTTOM}`).length > 0) {
          child2 = document.querySelectorAll(`#${this.divId} > .${Frameable.Classes.WINDOW_BOTTOM}`)[0];
        } else {
          console.error(`${this.divId} has top child but not bottom`);
        }
      }
      isHorizontal = false;
    }

    return { child1: child1, child2: child2, isHorizontal: isHorizontal };
  }

  resize(side, mousePos) {
    if (this.container == null) return;
    // console.log(side, this.container.getDivId());
    switch (side) {
      case Frameable.Sides.TOP:
        // Based on position of resizer line
        this.changeSize(this.container.width, parseInt(this.container.getDiv().style.height) - mousePos);
        this.getDiv().style.top = Math.round(mousePos) + "px";
        break;
      case Frameable.Sides.BOTTOM:
        this.changeSize(this.container.width, mousePos - this.getDiv().getBoundingClientRect().top);
        break;
      case Frameable.Sides.LEFT:
        // Based on position of resizer line
        this.changeSize(parseInt(this.container.getDiv().style.width) - mousePos, this.container.height);
        this.getDiv().style.left = Math.round(mousePos) + "px";
        break;
      case Frameable.Sides.RIGHT:
        this.changeSize(mousePos - this.getDiv().getBoundingClientRect().left, this.container.height);
        break;
      default:
        console.error("Window.resize: incorrect side");
    }

    if (this.children.length > 0)
      this.childrenResize();

    if (this.container != null) {
      this.calculateSizeFractionOfcontainer();
      this.getSibling().calculateSizeFractionOfcontainer();
      siblingWindowErrorCorrect(this);
    }

    this.repositionChildResizer();
    Frameable.windowResized();
  }

  calculateSizeFractionOfcontainer() {
    if (this.container == null) this.sizeFractionOfContainer = 1.0;
    else {
      if (this.container.isSplitHorizontally)
        this.sizeFractionOfContainer = this.width / this.container.width;
      else if (this.container.isSplitVertically)
        this.sizeFractionOfContainer = this.height / this.container.height;
    }
  }

  getSibling() {
    if (this.container == null) return null;
    if (this.container.children[0] == this) return this.container.children[1];
    else return this.container.children[0];
  }

  childrenResize() {
    if (this.children.length == 0)
      return; // Content window has no children

    if (this.isSplitHorizontally) {
      let height = this.height;
      this.children[0].changeSize(this.width * this.children[0].sizeFractionOfContainer, height);
      this.children[1].changeSize(this.width * this.children[1].sizeFractionOfContainer, height);
      this.children[1].getDiv().style.left = parseInt(this.children[0].getDiv().style.width) + "px";
    } else if (this.isSplitVertically) {
      this.children[0].changeSize(this.width, this.height * this.children[0].sizeFractionOfContainer);
      this.children[1].changeSize(this.width, this.height * this.children[1].sizeFractionOfContainer);
      this.children[1].getDiv().style.top = parseInt(this.children[0].getDiv().style.height) + "px";
    }

    this.children[0].childrenResize();
    this.children[1].childrenResize();

    this.repositionChildResizer();
  }

  changeSize(width, height) {
    if (width < this.minWidth)
      width = this.minWidth;
    if (height < this.minHeight)
      height = this.minHeight;

    if (this.container != null) {
      if (width > this.container.width - this.getSibling().minWidth && this.container.isSplitHorizontally) {
        width = this.container.width - this.getSibling().minWidth;
        this.container.repositionChildResizer();
      }
      if (height > this.container.height - this.getSibling().minHeight && this.container.isSplitVertically) {
        height = this.container.height - this.getSibling().minHeight;
        this.container.repositionChildResizer();
      }
    }

    if (this.container == null) {
      if (width > Frameable.parentContainer.clientWidth)
        width = Frameable.parentContainer.clientWidth;
      if (height > Frameable.parentContainer.clientHeight)
        height = Frameable.parentContainer.clientHeight;
    } else {
      if (width > this.container.width) {
        width = this.container.width;
      }
      if (height > this.container.height) {
        height = this.container.height;
      }
    }

    width = Math.round(width);
    height = Math.round(height);

    this.getDiv().style.width = width + "px";
    this.getDiv().style.height = height + "px";
    this.width = width;
    this.height = height;
  }

  repositionChildResizer() {
    if (this.childResizer != null)
      this.childResizer.reposition();
  }

  calculateMinWidthHeight() {
    if (this.children.length > 0) {
      // Recursively call this on all descendants
      this.children[0].calculateMinWidthHeight();
      this.children[1].calculateMinWidthHeight();
      if (this.isSplitHorizontally) {
        this.minWidth = this.children[0].minWidth + this.children[1].minWidth;
        if (this.children[0].minHeight > this.children[1].minHeight)
          this.minHeight = this.children[0].minHeight;
        else this.minHeight = this.children[1].minHeight;
      } else if (this.isSplitVertically) {
        this.minHeight = this.children[0].minHeight + this.children[1].minHeight;
        if (this.children[0].minWidth > this.children[1].minWidth)
          this.minWidth = this.children[0].minWidth;
        else this.minWidth = this.children[1].minWidth;
      }
    } else {
      this.minWidth = this.originalMinSize;
      this.minHeight = this.originalMinSize;
    }

    this.minWidth = Math.round(this.minWidth);
    this.minHeight = Math.round(this.minHeight);
  }

  getTopLevelcontainer() {
    let containerToReturn = this;
    while (containerToReturn.container != null) {
      containerToReturn = containerToReturn.container;
    }
    return containerToReturn;
  }

  splitHorizontally(leftWindowSizeFraction, leftDiv, rightDiv) {
    this.isSplitHorizontally = true;
    let leftWidth = Math.round(this.width * leftWindowSizeFraction);

    if (leftWidth != null && leftDiv != null) this.getDiv().appendChild(leftDiv);
    if (rightDiv != null) this.getDiv().appendChild(rightDiv);

    let w1 = new Frameable.ContentWindow(this, leftWidth, this.height, leftDiv);
    let w2 = new Frameable.ContentWindow(this, this.width - leftWidth, this.height, rightDiv);
    w2.getDiv().style.left = Math.round(leftWidth) + "px";

    this.childResizer = new Frameable.Resizer(this, w1, w2, true);
    this.childResizer.getDiv().style.left = Math.round(leftWidth) + "px";

    this.children.push(w1);
    this.children.push(w2);

    this.getTopLevelcontainer().calculateMinWidthHeight();
  }

  splitVertically(topWindowSizeFraction, topDiv, bottomDiv) {
    this.isSplitVertically = true;
    let topHeight = Math.round(this.height * topWindowSizeFraction);

    if (topDiv != null) this.getDiv().appendChild(topDiv);
    if (bottomDiv != null) this.getDiv().appendChild(bottomDiv);

    let w1 = new Frameable.ContentWindow(this, this.width, topHeight, topDiv);
    let w2 = new Frameable.ContentWindow(this, this.width, this.height - topHeight, bottomDiv);
    let topDivHeight = parseInt(topDiv.style.height);
    let bottomDivHeight = parseInt(bottomDiv.style.height);
    w2.getDiv().style.top = Math.round(topHeight) + "px";

    this.childResizer = new Frameable.Resizer(this, w1, w2, false);
    this.childResizer.getDiv().style.top = Math.round(topHeight) + "px";

    this.children.push(w1);
    this.children.push(w2);

    this.getTopLevelcontainer().calculateMinWidthHeight();
  }

};

Frameable.containerResize = function (width, height) {
  const containerWindow = Frameable.activeContentWindows[0];
  containerWindow.changeSize(width, height);
  containerWindow.repositionChildResizer();
  if (containerWindow.children.length > 0)
    containerWindow.childrenResize();

  if (containerWindow.container != null) {
    containerWindow.calculateSizeFractionOfcontainer();
    containerWindow.getSibling().calculateSizeFractionOfcontainer();
    siblingWindowErrorCorrect(containerWindow);
  }

  containerWindow.repositionChildResizer();
  Frameable.windowResized();
}

function resizerMouseDown(event) {
  event.preventDefault();
  Frameable.parentContainer.classList.add('frameable-dpe');
  Frameable.resizingStarted();
  event.stopPropagation();
  Frameable.currentResizer = getResizerFromDiv(this.id);
  Frameable.currentResizer.getDiv().classList.add('active');
  window.addEventListener('mousemove', Frameable.currentResizer.resize);
  window.addEventListener('mouseup', Frameable.currentResizer.cancelResize);
}

function resizerTouchStart() {
  Frameable.parentContainer.classList.add('frameable-dpe');
  Frameable.resizingStarted();
  Frameable.currentResizer = getResizerFromDiv(this.id);
  Frameable.currentResizer.getDiv().classList.add('active');
  window.addEventListener('touchmove', Frameable.currentResizer.resize);
  window.addEventListener('touchend', Frameable.currentResizer.cancelResize);
}

function attachResizerEvents() {
  let elements = document.querySelectorAll('.frameable-resizer');
  if (elements) {
    elements.forEach(function (el) {
      el.addEventListener('mousedown', resizerMouseDown);
      el.addEventListener('touchstart', resizerTouchStart);
    });
  }
}

function clearResizerEvents() {
  let elements = document.querySelectorAll('.frameable-resizer');
  if (elements) {
    elements.forEach(function (el) {
      el.removeEventListener('mousedown', resizerMouseDown);
      el.removeEventListener('touchstart', resizerTouchStart);
    });
  }
}

function getResizerFromDiv(divId) {
  for (let i = 0; i < Frameable.activeResizers.length; i++) {
    if (Frameable.activeResizers[i].getDivId() == divId) {
      return Frameable.activeResizers[i];
    }
  }
  console.error("getResizerFromDiv failed to find resizer");
  return null;
}

function siblingWindowErrorCorrect(child) {
  child.getSibling().sizeFractionOfContainer = 1 - child.sizeFractionOfContainer;
}

Frameable.windowResized = function () {
  // Code to run when any window is resized should be placed here.
};

Frameable.resizingEnded = function () {
  // Runs whenever a resizer is clicked
}

Frameable.resizingStarted = function () {
  // Runs on the next 'mouseup' or 'touchend' events after a resizer is clicked
}

Frameable.Resizer = class {
  constructor(container, window1, window2, isHorizontal) {
    this.container = container;
    this.isHorizontal = isHorizontal;
    if (this.isHorizontal) {
      this.leftWindow = window1;
      this.rightWindow = window2;
    } else {
      // Vertical Resizer
      this.topWindow = window1;
      this.bottomWindow = window2;
    }

    this.divId = `frameable-resizer-${Frameable.activeResizers.length}`;

    let div = document.createElement('div');
    div.id = this.divId;
    div.classList.add('frameable-resizer');
    container.getDiv().appendChild(div);

    if (this.isHorizontal) {
      this.getDiv().classList.add("h-resizer");
      this.getDiv().style.cursor = "ew-resize";
    } else {
      this.getDiv().classList.add("v-resizer");
      this.getDiv().style.cursor = "ns-resize";
    }

    this.getDiv().style.position = "absolute";

    this.lineThickness = Frameable.resizerThickness;
    if (isHorizontal) {
      this.getDiv().style.width = Math.round(this.lineThickness) + "px";
      this.getDiv().style.height = this.container.height + "px";
    } else {
      this.getDiv().style.width = this.container.width + "px";
      this.getDiv().style.height = this.lineThickness + "px";
    }

    this.reposition();

    Frameable.activeResizers.push(this);
    clearResizerEvents();
    attachResizerEvents();
  }

  getDiv() {
    return document.getElementById(this.divId);
  }

  getDivId() {
    return this.divId;
  }

  reposition() {
    if (this.isHorizontal) {
      this.getDiv().style.left = this.leftWindow.getDiv().style.width;
      this.getDiv().style.height = this.container.getDiv().style.height;
    } else {
      this.getDiv().style.top = this.topWindow.getDiv().style.height;
      this.getDiv().style.width = this.container.getDiv().style.width;
    }
  }

  resize(event) {
    let inputX = event.pageX;
    let inputY = event.pageY;
    if (inputX == undefined)
      inputX = event.changedTouches[0].pageX;
    if (inputY == undefined)
      inputY = event.changedTouches[0].pageY;
    else event.preventDefault();

    // Find the current resizer being clicked
    if (Frameable.currentResizer == null) {
      for (let i = 0; i < Frameable.activeResizers.length; i++) {
        if (Frameable.activeResizers[i].getDiv() == event.target) {
          Frameable.currentResizer = Frameable.activeResizers[i];
        }
      }
    }

    if (Frameable.currentResizer.isHorizontal) {
      // Change size of left window
      Frameable.currentResizer.leftWindow.resize(Frameable.Sides.RIGHT, inputX);
      // Change the size of the right window
      let leftWindowWidth = Frameable.currentResizer.leftWindow.getDiv().style.width;
      Frameable.currentResizer.getDiv().style.left = leftWindowWidth;
      Frameable.currentResizer.rightWindow.resize(Frameable.Sides.LEFT, parseInt(leftWindowWidth));
    } else {
      // Change size of the top window
      Frameable.currentResizer.topWindow.resize(Frameable.Sides.BOTTOM, inputY);
      // Change size of the bottom window and move resizer
      let topWindowHeight = Frameable.currentResizer.topWindow.getDiv().style.height;
      Frameable.currentResizer.getDiv().style.top = topWindowHeight;
      Frameable.currentResizer.bottomWindow.resize(Frameable.Sides.TOP, parseInt(topWindowHeight));
    }
  }

  delete() {
    for (let i = 0; i < Frameable.activeResizers.length; i++) {
      if (Frameable.activeResizers[i] == this)
        Frameable.activeResizers.splice(i, 1);
    }
    this.getDiv().containerNode.removeChild(this.getDiv());
  }

  cancelResize() {
    window.removeEventListener("mousemove", Frameable.currentResizer.resize);
    window.removeEventListener("mouseup", Frameable.currentResizer.cancelResize);
    window.removeEventListener("touchmove", Frameable.currentResizer.resize);
    window.removeEventListener("touchend", Frameable.currentResizer.cancelResize);
    Frameable.currentResizer.getDiv().classList.remove('active');
    Frameable.currentResizer = null;
    Frameable.resizingEnded();
    Frameable.parentContainer.classList.remove('frameable-dpe');
  }

};
