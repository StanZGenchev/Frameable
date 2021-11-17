# Frameable

Frameable is a simple iframe layout engine written in JavaScript.

## Why an iframe layout?

When you have a big web application, it's a good idea to break it down into different views and isolate those views into their own iframe. The aim is to make the app more modular, easier to maintain and prevent small changes breaking the UI of the whole app.

## Is there a demo?

There is no live demo but you can open the `index.html` directly in your browser and see the example page.

## How to use it?

Copy the `frameable-style.css` and `frameable.js` files into you project and reference then in the head tag like so:

```html
<link rel="stylesheet" type="text/css" href="frameable-style.css" />
<script type="text/javascript" src="frameable.js"></script>
```

Then you need to create an HTML element that will contain the different frames. You must give it an ID which will be used when initializing Frameable.

```html
<div id="frameable-container"></div>
```

Then create a layout config. It's a list of frame objects. Frame objects have 4 keys:

- `position` - The position of the frame. There are four option available: `top`, `left`, `bottom`, `right`
- `size` - The relative size of the frame. Biggest value is 1.0, smallest is 0.1
- `url` - The url that will be loaded by the iframe
- `data` - In case you want to pass data to the iframe, you can use this which will be translated to a custom attribute, applied to the iframe itself. Then you can use standard JS functions to get the data. See `page.html` to see an example.

There is another special object which can contain a list of children:

- `position` - Same as above
- `children` - List of nested frame objects

Here is a full example:

```javascript
let framesConfig = [
  {
    position: "left",
    size: 0.15,
    url: "page.html",
    data: "left",
  },
  {
    position: "right",
    children: [
      {
        position: "top",
        size: 0.8,
        url: "page.html",
        data: "top right",
      },
      {
        position: "bottom",
        url: "page.html",
        data: "bottom right",
      },
    ],
  },
];
```

You can also change the resize bar.

 * `thickness` - Resizer thickness in pixels
 * `highlightThickness` - Thickness of the additional resize handle border when hovered over

Example:

```javascript
let resizerConfig = {
  thickness: 3,
  highlightThickness: 0,
};
```

Finally, initialize Frameable:

```javascript
Frameable.initialise("main", framesConfig, resizerConfig);
// or if there is no custom resizer
Frameable.initialise("main", framesConfig);
```

### Additional information

This project started as a fork of Tom Rawlings's [Resizable.js](https://github.com/Tom-Rawlings/Resizable.js) but was heavily modified to fit different use-cases.
