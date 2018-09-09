const crypto = require('crypto');
const electron = require('electron');
const fs = require('graceful-fs');
const keyPathHelpers = require('key-path-helpers');
const mkdirp = require('mkdirp');
const path = require('path');
const writeFileAtomic = require('write-file-atomic');

const { isKeyPath, flattenKeyPath } = require('./keypath');
const defaults = require('./defaults');

let config = Object.assign({}, defaults);

/**
 * Returns the Electron instance. This may be defined by
 * the user during instantiation.
 *
 * @returns {Electron}
 */
function getElectron() {
  if (config.electron) {
    return config.electron;
  } else {
    return electron;
  }
}

/**
 * Returns the Electron app. Depending on which process
 * this code is running in -- main or renderer -- we
 * may need to import the app via Remote.
 *
 * @see https://electronjs.org/docs/api/app#app
 * @see https://electronjs.org/docs/api/remote
 * @returns {Electron.App}
 */
function getElectronApp() {
  const e = getElectron();
  const app = e.app || e.remote.app;

  return app;
}

/**
 * Returns the path to the directory where Electron
 * Settings will save data to. By default, this is the
 * Electron app's unique user data path, but a custom
 * directory can be defined during instantiation.
 *
 * @see https://electronjs.org/docs/api/app#appgetpathname
 * @returns {string}
 */
function getSettingsDirPath() {
  if (config.dir) {
    return config.dir;
  } else {
    return getElectronApp().getPath('userData');
  }
}

/**
 * Returns the path to the file where Electron Settings
 * will save data to.
 *
 * @returns {string}
 */
function getSettingsFilePath() {
  const dir = getSettingsDirPath();
  const filePath = path.join(dir, config.fileName);

  return filePath;
}

/**
 * Encrypts the given data using the encryption algorithm
 * and key, then returns the encrypted buffer.
 *
 * @param {string} data
 * @returns {Buffer}
 */
function encryptData(data) {
  const buffer = Buffer.from(data);
  const algorithm = config.encryptionAlgorithm;
  const key = config.encryptionKey;
  const cipher = crypto.createCipher(algorithm, key);
  const enc = Buffer.concat([cipher.update(buffer), cipher.final()]);

  return enc;
}

/**
 * Decrypts the given buffer using the algorithm and key
 * used to encrypt it, then returns the decrypted data
 * as a UTF-8 string.
 *
 * @param {Buffer} buffer
 * @returns {string}
 */
function decryptData(buffer) {
  const algorithm = config.encryptionAlgorithm;
  const key = config.encryptionKey;
  const decipher = crypto.createDecipher(algorithm, key);
  const dec = Buffer.concat([decipher.update(buffer), decipher.final()]);

  return dec.toString('utf8');
}

/**
 * Prepares the settings data by stringifying the
 * settings object, encrypting the data (if applicable),
 * then returning a buffer if the data is encrypted, or
 * otherwise a UTF-8 string.
 *
 * @param {Object} obj
 * @returns {string|Buffer}
 */
function prepareSettingsData(obj) {
  const numSpaces = config.prettify ? config.numSpaces : 0;
  let data = JSON.stringify(obj, null, numSpaces);

  if (config.encryptionKey) {
    data = encryptData(data);
  }

  return data;
}

/**
 * Reconstructs the settings object by decrypting the
 * settings object (if applicable), parsing it back into
 * JSON, then returning the resulting Object.
 *
 * @param {string|Buffer} data
 * @returns {Object}
 */
function reconstructSettingsData(data) {
  let maybeDecryptedData = data;

  if (config.encryptionKey) {
    maybeDecryptedData = decryptData(data);
  }

  return JSON.parse(maybeDecryptedData);
}

/**
 * Ensures the directory where the settings file will be
 * saved exists.
 *
 * @param {Function} fn
 * @returns {void}
 */
function ensureSettingsDir(fn) {
  const dir = getSettingsDirPath();

  fs.stat(dir, (err) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // Directory does not exist.
        mkdirp(dir, fn);
      } else {
        fn(err);
      }
    } else {
      fn(null);
    }
  });
}

/**
 * Synchronously ensures the directory where the settings
 * file will be saved exists.
 *
 * @returns {void}
 */
function ensureSettingsDirSync() {
  const dir = getSettingsDirPath();

  try {
    fs.statSync(dir);
  } catch (err) {
    if (err.code === 'ENOENT') {
      // Directory does not exist.
      mkdirp.sync(dir);
    } else {
      throw err;
    }
  }
}

/**
 * Ensures the settings file exists then writes the
 * settings to the file system.
 *
 * @param {string} data
 * @param {Function} fn
 * @returns {void}
 */
function writeSettingsFile(data, fn) {
  const filePath = getSettingsFilePath();

  ensureSettingsDir((err) => {
    if (err) return fn(err);

    if (config.atomicSave) {
      writeFileAtomic(filePath, data, fn);
    } else {
      fs.writeFile(filePath, data, fn);
    }
  });
}

/**
 * Synchronously Ensures the settings file exists then
 * writes the settings to the file system.
 *
 * @param {string} data
 * @returns {void}
 */
function writeSettingsFileSync(data) {
  const filePath = getSettingsFilePath();

  ensureSettingsDirSync();

  if (config.atomicSave) {
    writeFileAtomic.sync(filePath, data);
  } else {
    fs.writeFileSync(filePath, data);
  }
}

/**
 * Synchronously saves the settings object to the disk.
 *
 * @param {Object} obj
 * @returns {void}
 */
function saveSettingsSync(obj) {
  const data = prepareSettingsData(obj);

  writeSettingsFileSync(data);
}

/**
 * @callback Settings~readSettingsFileCallback
 * @param {?Error} err
 * @param {?Object} obj
 */

/**
 * Reads the (potentially encrypted) settings data from
 * the disk then reconstructs it back into a JSON object.
 *
 * @param {Settings~readSettingsFileCallback} fn
 * @returns {void}
 */
function readSettingsFile(fn) {
  const filePath = getSettingsFilePath();
  const encoding = config.encryptionKey ? null : 'utf-8';

  fs.readFile(filePath, encoding, (err, data) => {
    if (err) return fn(err);

    try {
      fn(null, reconstructSettingsData(data));
    } catch (err) {
      fn(err);
    }
  });
}

/**
 * Synchronously reads the (potentially encrypted)
 * settings data from the disk then reconstructs it back
 * into a JSON object.
 *
 * @returns {Object}
 */
function readSettingsFileSync() {
  const filePath = getSettingsFilePath();
  const encoding = config.encryptionKey ? null : 'utf-8';
  const data = fs.readFileSync(filePath, encoding);
  const obj = reconstructSettingsData(data);

  return obj;
}

/**
 * Saves the settings object to the disk.
 *
 * @param {Object} obj
 * @param {Function} fn
 * @returns {void}
 */
function saveSettings(obj, fn) {
  let data;

  try {
    data = prepareSettingsData(obj);
  } catch (err) {
    return fn(err);
  }

  writeSettingsFile(data, fn);
}

/**
 * Ensures that the sttings file exists. If no file
 * exists, then it is created and an empty object is
 * saved.
 *
 * @param {Function} fn
 * @returns {void}
 */
function ensureSettingsFile(fn) {
  const filePath = getSettingsFilePath();

  fs.stat(filePath, (err) => {
    if (err) {
      if (err.code === 'ENOENT') {
        saveSettings({}, fn);
      } else {
        fn(err);
      }
    } else {
      fn(null);
    }
  });
}

/**
 * Synchronously ensures that the sttings file exists. If
 * no file exists, then it is created and an empty object
 * is saved.
 *
 * @returns {void}
 */
function ensureSettingsFileSync() {
  const filePath = getSettingsFilePath();

  try {
    fs.statSync(filePath);
  } catch (err) {
    if (err) {
      if (err.code === 'ENOENT') {
        saveSettingsSync({});
      } else {
        throw err;
      }
    }
  }
}

/**
 * @callback Settings~loadSettingsCallback
 * @param {?Error} err
 * @param {?Object} obj
 */

/**
 * Loads the settings data from the disk.
 *
 * @param {Settings~loadSettingsCallback}
 * @returns {void}
 */
function loadSettings(fn) {
  ensureSettingsFile((err) => {
    if (err) return fn(err);

    readSettingsFile(fn);
  });
}

/**
 * Synchronously loads the settings data from the disk.
 *
 * @returns {Object}
 */
function loadSettingsSync() {
  ensureSettingsFileSync();

  const obj = readSettingsFileSync();

  return obj;
}

/**
 * Gets the setting value at the given key path, or gets
 * the entire settings object if the key path is null.
 *
 * @param {?string} keyPath
 * @param {Function} fn
 * @returns {void}
 */
function getValueAtKeyPath(keyPath, fn) {
  loadSettings((err, obj) => {
    if (err) return fn(err);

    if (keyPath) {
      const val = keyPathHelpers.getValueAtKeyPath(obj, keyPath);

      fn(null, val);
    } else {
      fn(null, obj);
    }
  });
}

/**
 * Synchronously gets the setting value at the given key
 * path, or gets the entire settings object if the key
 * path is null.
 *
 * @param {?string} keyPath
 * @returns {any}
 */
function getValueAtKeyPathSync(keyPath) {
  const obj = loadSettingsSync();

  if (keyPath) {
    const val = keyPathHelpers.getValueAtKeyPath(obj, keyPath);

    return val;
  } else {
    return obj;
  }
}

/**
 * Checks if the key path exists.
 *
 * @param {string} keyPath
 * @param {Settings~hasCallback} fn
 * @returns {void}
 */
function hasKeyPath(keyPath, fn) {
  loadSettings((err, obj) => {
    if (err) return fn(err);

    const exists = keyPathHelpers.hasKeyPath(obj, keyPath);

    fn(null, exists);
  });
}

/**
 * Synchronously if the key path exists.
 *
 * @param {string} keyPath
 * @returns {boolean}
 */
function hasKeyPathSync(keyPath) {
  const obj = loadSettingsSync();
  const exists = keyPathHelpers.hasKeyPath(obj, keyPath);

  return exists;
}

/**
 * Sets the value at the given key path, or sets the
 * entire settings object if the key path is null.
 *
 * @param {?string} keyPath
 * @param {any} val
 * @param {Settings~setCallback} fn
 * @returns {void}
 */
function setValueAtKeyPath(keyPath, val, fn) {
  if (keyPath) {
    loadSettings((err, obj) => {
      if (err) return fn(err);

      keyPathHelpers.setValueAtKeyPath(obj, keyPath, val);

      saveSettings(obj, fn);
    });
  } else {
    saveSettings(val, fn);
  }
}

/**
 * Synchronously sets the value at the given key path, or
 * sets the entire settings object if the key path is
 * null.
 *
 * @param {?string} keyPath
 * @param {any} val
 * @returns {void}
 */
function setValueAtKeyPathSync(keyPath, val) {
  if (keyPath) {
    const obj = loadSettingsSync();

    keyPathHelpers.setValueAtKeyPath(obj, keyPath, val);

    saveSettingsSync(obj);
  } else {
    saveSettingsSync(val);
  }
}

/**
 * Deletes the setting at the given key path.
 *
 * @param {string} keyPath
 * @param {Settings~unsetCallback} fn
 * @returns {void}
 */
function unsetValueAtKeyPath(keyPath, fn) {
  loadSettings((err, obj) => {
    if (err) return fn(err);

    keyPathHelpers.deleteValueAtKeyPath(obj, keyPath);

    saveSettings(obj, fn);
  });
}

/**
 * Synchronously deletes the setting at the given key
 * path.
 *
 * @param {string} keyPath
 * @returns {void}
 */
function unsetValueAtKeyPathSync(keyPath) {
  const obj = loadSettingsSync();

  keyPathHelpers.deleteValueAtKeyPath(obj, keyPath);

  saveSettingsSync(obj);
}

/**
 * Resets the global configuration options.
 *
 * @param {Object} [opts]
 * @returns {void}
 * @public
 */
function reset() {
  config = Object.assign({}, defaults);
}

/**
  * Sets the global configuration options.
  *
  * Example:
  *
  *   Configures Electron Settings to prettify the JSON
  *   output using 4 spaces.
  *
  *    ```
  *    configure({
  *      prettify: true,
  *      numSpaces: 4
  *    });
  *    ```
 *
 * @param {Object} opts
 * @returns {void}
 * @public
 */
function configure(opts) {
  config = Object.assign({}, defaults, config, opts);
}

/**
 * Returns the absolute path to the settings file.
 *
 * Examples:
 *
 *   1. Gets the path to the settings file.
 *
 *       ```
 *       file();
 *       ```
 *
 * @returns {string}
 * @public
 */
function file() {
  return getSettingsFilePath();
}

/**
 * @callback Settings~getCallback
 * @param {?Error} err
 * @param {any} val
 */

/**
 * Asynchronously gets the value at the given key path,
 * or returns the entire settings object if no key path
 * is given.
 *
 * Examples:
 *
 *   1. Gets the value at the key.
 *
 *       ```
 *       get('foo', (err, val) => {
 *         console.log(val);
 *       });
 *       ```
 *
 *   2. Gets the value at the key path.
 *
 *       ```
 *       get('foo.bar', (err, val) => {
 *         console.log(val);
 *       });
 *       ```
 *
 *   3. Gets the value at the escaped key path. This is
 *      is useful if your settings key contains a period.
 *      Ordinarily, periods are interpreted as key path
 *      delimeters, but by adding an escape sequence you
 *      can ask Electron Settings to treat the period as
 *      part of the key itself.
 *
 *       ```
 *       get('foo\\.bar', (err, val) => {
 *         console.log(val);
 *       });
 *       ```
 *
 *   4. Gets the value at the array key path. This is
 *      useful if part of your key path is constructed
 *      using some sort of variable.
 *
 *       ```
 *       const bar = 'bar';
 *       get(['foo', bar], (err, val) => {
 *         console.log(val);
 *       });
 *       ```
 *
 *   5. Gets all  If you omit the key path
 *      argument, Electron Settings will return the
 *      entire settings object instead of just the value
 *      at a single key path.
 *
 *       ```
 *       get((err, obj) => {
 *         console.log(obj);
 *       });
 *       ```
 *
 * @param {KeyPath~keyPath} keyPath
 * @param {Settings~getCallback} fn
 * @returns {void}
 * @public
 */
function get(...args) {
  if (isKeyPath(args[0])) {
    args.splice(0, 1, flattenKeyPath(args[0]));
  } else {
    args.splice(0, 0, null);
  }

  getValueAtKeyPath(...args);
}

/**
 * Synchronously gets the value at the given key path, or
 * returns the entire settings object if no key path is
 * provided.
 *
 * Examples:
 *
 *   1. Gets the value at the key.
 *
 *       ```
 *       const val = getSync('foo');
 *       ```
 *
 *   2. Gets the value at the key path.
 *
 *       ```
 *       const val = getSync('foo.bar');
 *       ```
 *
 *   3. Gets the value at the escaped key path. This is
 *      is useful if your settings key contains a period.
 *      Ordinarily, periods are interpreted as key path
 *      delimeters, but by adding an escape sequence you
 *      can ask Electron Settings to treat the period as
 *      part of the key itself.
 *
 *       ```
 *       const val = getSync('foo\\.bar');
 *       ```
 *
 *   4. Gets the value at the array key path. This is
 *      useful if part of your key path is constructed
 *      using some sort of variable.
 *
 *       ```
 *       const bar = 'bar';
 *       const val = getSync(['foo', bar]);
 *       ```
 *
 *   5. Gets all  If you omit the key path
 *      argument, Electron Settings will return the
 *      entire settings object instead of just the value
 *      at a single key path.
 *
 *       ```
 *       const obj = getSync();
 *       ```
 *
 * @param {KeyPath~keyPath} keyPath
 * @returns {any}
 * @public
 */
function getSync(...args) {
  if (isKeyPath(args[0])) {
    args.splice(0, 1, flattenKeyPath(args[0]));
  } else {
    args.splice(0, 0, null);
  }

  return getValueAtKeyPathSync(...args);
}

/**
 * @callback Settings~hasCallback
 * @param {?Error} err
 * @param {?boolean} exists
 */

/**
 * Asynchronously checks if the the given key path exists.
 *
 * Examples:
 *
 *   1. Checks if the key exists.
 *
 *       ```
 *       has('foo', (err, exists) => {
 *         console.log(exists);
 *       });
 *       ```
 *
 *   2. Checks if the key path exists.
 *
 *       ```
 *       has('foo.bar', (err, exists) => {
 *         console.log(exists);
 *       });
 *       ```
 *
 *   3. Checks if the the escaped key path exists. This
 *      is is useful if your settings key contains a
 *      period. Ordinarily, periods are interpreted as
 *      key path delimeters, but by adding an escape
 *      sequence you can ask Electron Settings to treat
 *      the period as part of the key itself.
 *
 *       ```
 *       has('foo\\.bar', (err, exists) => {
 *         console.log(exists);
 *       });
 *       ```
 *
 *   4. Checks if the array key path exists. This is
 *      useful if part of your key path is constructed
 *      using some sort of variable.
 *
 *       ```
 *       const bar = 'bar';
 *       has(['foo', bar], (err, exists) => {
 *         console.log(exists);
 *       });
 *       ```
 *
 * @throws {TypeError} If key path is not valid.
 * @param {KeyPath~keyPath} keyPath
 * @param {Settings~hasCallback} fn
 * @returns {void}
 * @public
 */
function has(...args) {
  if (isKeyPath(args[0])) {
    args.splice(0, 1, flattenKeyPath(args[0]));
  } else {
    throw new TypeError('The given key path was not valid');
  }

  hasKeyPath(...args);
}

/**
 * Synchronously checks if the the given key path exists.
 *
 * Examples:
 *
 *   1. Checks if the key exists.
 *
 *       ```
 *       const exists = hasSync('foo');
 *       ```
 *
 *   2. Checks if the key path exists.
 *
 *       ```
 *       const exists = hasSync('foo.bar');
 *       ```
 *
 *   3. Checks if the the escaped key path exists. This
 *      is is useful if your settings key contains a
 *      period. Ordinarily, periods are interpreted as
 *      key path delimeters, but by adding an escape
 *      sequence you can ask Electron Settings to treat
 *      the period as part of the key itself.
 *
 *       ```
 *       const exists = hasSync('foo\\.bar');
 *       ```
 *
 *   4. Checks if the array key path exists. This is
 *      useful if part of your key path is constructed
 *      using some sort of variable.
 *
 *       ```
 *       const bar = 'bar';
 *       const exists = hasSync(['foo', bar]);
 *       ```
 *
 * @throws {TypeError} If key path is not valid.
 * @param {KeyPath~keyPath} keyPath
 * @returns {boolean}
 * @public
 */
function hasSync(...args) {
  if (isKeyPath(args[0])) {
    args.splice(0, 1, flattenKeyPath(args[0]));
  } else {
    throw new TypeError('The given key path was not valid');
  }

  return hasKeyPathSync(...args);
}

/**
 * @callback Settings~setCallback
 * @param {?Error} err
 */

/**
 * Asynchronously sets the value at the given key path,
 * or set the entire settings object if no key path is
 * given.
 *
 * Examples:
 *
 *   1. Sets the value at the key.
 *
 *       ```
 *       set('foo', 'bar', (err) => {
 *         // ...
 *       });
 *       ```
 *
 *   2. Sets the value at the key path.
 *
 *       ```
 *       set('foo.bar', 'baz', (err) => {
 *         // ...
 *       });
 *       ```
 *
 *   3. Sets the value at the escaped key path. This is
 *      is useful if your settings key contains a period.
 *      Ordinarily, periods are interpreted as key path
 *      delimeters, but by adding an escape sequence you
 *      can ask Electron Settings to treat the period as
 *      part of the key itself.
 *
 *       ```
 *       set('foo\\.bar', 'baz', (err) => {
 *         // ...
 *       });
 *       ```
 *
 *   4. Sets the value at the array key path. This is
 *      useful if part of your key path is constructed
 *      using some sort of variable.
 *
 *       ```
 *       const bar = 'bar';
 *       set(['foo', bar], 'baz', (err) => {
 *         // ...
 *       });
 *       ```
 *
 *   5. Sets all  If you omit the key path
 *      argument, Electron Settings will return the
 *      entire settings object instead of just the value
 *      at a single key path.
 *
 *       ```
 *       set({ foo: 'bar' }, (err) => {
 *         // ...
 *       });
 *       ```
 *
 * @param {KeyPath~keyPath} [keyPath]
 * @param {any} val
 * @param {Settings~setCallback} fn
 * @returns {void}
 * @public
 */
function set(...args) {
  if (isKeyPath(args[0])) {
    args.splice(0, 1, flattenKeyPath(args[0]));
  } else {
    args.splice(0, 0, null);
  }

  setValueAtKeyPath(...args);
}

/**
 * Synchronously sets the value at the given key path,
 * or set the entire settings object if no key path is
 * given.
 *
 * Examples:
 *
 *   1. Sets the value at the key.
 *
 *       ```
 *       setSync('foo', (e);
 *       ```
 *
 *   2. Sets the value at the key path.
 *
 *       ```
 *       setSync('foo.bar', 'baz');
 *       ```
 *
 *   3. Sets the value at the escaped key path. This is
 *      is useful if your settings key contains a period.
 *      Ordinarily, periods are interpreted as key path
 *      delimeters, but by adding an escape sequence you
 *      can ask Electron Settings to treat the period as
 *      part of the key itself.
 *
 *       ```
 *       setSync('foo\\.bar', 'baz');
 *       ```
 *
 *   4. Sets the value at the array key path. This is
 *      useful if part of your key path is constructed
 *      using some sort of variable.
 *
 *       ```
 *       const bar = 'bar';
 *       setSync(['foo', bar], 'baz');
 *       ```
 *
 *   5. Sets all  If you omit the key path
 *      argument, Electron Settings will return the
 *      entire settings object instead of just the value
 *      at a single key path.
 *
 *       ```
 *       setSync({ foo: 'bar' });
 *       ```
 *
 * @param {KeyPath~keyPath} [keyPath]
 * @param {any} val
 * @returns {void}
 * @public
 */
function setSync(...args) {
  if (isKeyPath(args[0])) {
    args.splice(0, 1, flattenKeyPath(args[0]));
  } else {
    args.splice(0, 0, null);
  }

  setValueAtKeyPathSync(...args);
}

/**
 * @callback Settings~unsetCallback
 * @param {?Error} err
 */

/**
 * Asynchronously deletes the given key path.
 *
 * Examples:
 *
 *   1. Deletes the key.
 *
 *       ```
 *       unset('foo', (err) => {
 *         // ...
 *       });
 *       ```
 *
 *   2. Deletes the final key of the key path.
 *
 *       ```
 *       unset('foo.bar', (err) => {
 *         // ...
 *       });
 *       ```
 *
 *   3. Deletes the final key of the escaped key path.
 *      This is is useful if your settings key contains a
 *      period. Ordinarily, periods are interpreted as
 *      key path delimeters, but by adding an escape
 *      sequence you can ask Electron Settings to treat
 *      the period as part of the key itself.
 *
 *       ```
 *       unset('foo\\.bar', (err) => {
 *         // ...
 *       });
 *       ```
 *
 *   4. Deletes the final key of the array key path. This
 *      is useful if part of your key path is constructed
 *      using some sort of variable.
 *
 *       ```
 *       const bar = 'bar';
 *       unset(['foo', bar], (err) => {
 *         // ...
 *       });
 *       ```
 *
 * @throws {TypeError} If key path is not valid.
 * @param {KeyPath~keyPath} keyPath
 * @param {Settings~unsetCallback} fn
 * @returns {void}
 * @public
 */
function unset(...args) {
  if (isKeyPath(args[0])) {
    args.splice(0, 1, flattenKeyPath(args[0]));
  } else {
    throw new TypeError('The given key path was not valid');
  }

  unsetValueAtKeyPath(...args);
}

/**
 * Synchronously deletes the given key path.
 *
 * Examples:
 *
 *   1. Deletes the key.
 *
 *       ```
 *       unsetSync('foo');
 *       ```
 *
 *   2. Deletes the final key of the key path.
 *
 *       ```
 *       unsetSync('foo.bar');
 *       ```
 *
 *   3. Deletes the final key of the escaped key path.
 *      This is is useful if your settings key contains a
 *      period. Ordinarily, periods are interpreted as
 *      key path delimeters, but by adding an escape
 *      sequence you can ask Electron Settings to treat
 *      the period as part of the key itself.
 *
 *       ```
 *       unsetSync('foo\\.bar');
 *       ```
 *
 *   4. Deletes the final key of the array key path. This
 *      is useful if part of your key path is constructed
 *      using some sort of variable.
 *
 *       ```
 *       const bar = 'bar';
 *       unsetSync(['foo', bar]);
 *       ```
 *
 * @throws {TypeError} If key path is not valid.
 * @param {KeyPath~keyPath} keyPath
 * @returns {void}
 * @public
 */
function unsetSync(...args) {
  if (isKeyPath(args[0])) {
    args.splice(0, 1, flattenKeyPath(args[0]));
  } else {
    throw new TypeError('The given key path was not valid');
  }

  unsetValueAtKeyPathSync(...args);
}

module.exports = {
  reset,
  configure,
  file,
  get,
  getSync,
  has,
  hasSync,
  set,
  setSync,
  unset,
  unsetSync,

  // Unsafe legacy aliases:
  delete: unset,
  deleteSync: unsetSync,
};
