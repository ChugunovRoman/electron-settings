/**
 * A key path is the string equivalent of dot notation in
 * JavaScript. Take the following object, for example:
 *
 *   ```
 *   const obj = {
 *     foo: {
 *       bar: 'baz'
 *     }
 *   };
 *   ```
 *
 * You can access the value of the key "bar" in plain
 * JavaScript by traversing the tree using object dot
 * notation, like so:
 *
 *   ```
 *   console.log(obj.foo.bar);
 *   // => "baz"
 *  ```
 *
 * Similarly in Electron Settings, you are reading and
 * writing to a JSON object in a file, and a key path is
 * just a string that points to a specific key within that
 * object -- essentially using object dot notation in
 * string form.
 *
 * Key paths need not be just strings. In fact, there are
 * perfectly valid use-cases where you might need to access
 * a key, but the name of the key is stored in some
 * variable. In this case, you can specify an array of
 * strings -- or even an array of key paths -- and they
 * can be flattened into a regular key path.
 *
 * Using key paths, you are not limited to setting top-
 * level keys like you would be with LocalStorage. With
 * Electron Settings, you can deeply nest properties like
 * you would with any other object in JavaScript, and it
 * just feels natural.
 *
 * @typedef {string|string[]} KeyPath~keyPath
 */

/**
 * A helper function which checks if the given parameter
 * is a true key path or not.
 *
 * Examples:
 *
 *   1. Validates strings.
 *
 *       ```
 *       isKeyPath('foo');
 *       // => true

 *       isKeyPath('foo.bar');
 *       // => true

 *       isKeyPath(42);
 *       // => false
 *       ```
 *
 *   2. Validates arrays of key paths.
 *
 *       ```
 *       isKeyPath(['foo']);
 *       // => true

 *       isKeyPath(['foo', 'bar']);
 *       // => true

 *       isKeyPath(['foo', 42]);
 *       // => false
 *       ```
 *
 * @param {any} keyPath
 * @returns {boolean}
 */
function isKeyPath(keyPath) {
  if (typeof keyPath === 'string') return true;

  if (Array.isArray(keyPath)) {
    for (let i = 0, len = keyPath.length; i < len; i++) {
      if (isKeyPath(keyPath[i]) && i === len - 1) {
        return true;
      }
    }
  }

  return false;
}

/**
 * A helper function which flattens a key path into a
 * string.
 *
 * Examples:
 *
 *   1. Passes a string through.
 *
 *       ```
 *       flattenKeyPath('foo.bar');
 *       // => "foo.bar"
 *       ```
 *
 *   2. Flattens a key path array into a string key path.
 *
 *       ```
 *       flattenKeyPath(['foo', 'bar']);
 *       // => "foo.bar"
 *       ```
 *
 *   3. Flattens a nested key path array into a string key
 *      path.
 *
 *       ```
 *       flattenKeyPath([['foo', 'bar'], 'baz']);
 *       // => "foo.bar.baz"
 *       ```
 *
 * @param {KeyPath~keyPath}
 * @returns {string}
 */
function flattenKeyPath(keyPath) {
  if (Array.isArray(keyPath)) {
    return keyPath.map((a) => flattenKeyPath(a)).join('.');
  } else {
    return keyPath;
  }
}

module.exports = {
  isKeyPath,
  flattenKeyPath,
};
