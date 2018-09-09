const assert = require('assert');
const crypto = require('crypto');
const electron = require('electron');
const fs = require('fs');
const mkdirp = require('mkdirp');
const path = require('path');
const randomstring = require('randomstring');
const rimraf = require('rimraf');

const settings = require('../');

const testDir = path.join(__dirname, 'tmp');

const getUserDataPath = () => {
  const app = electron.app || electron.remote.app;
  const userDataPath = app.getPath('userData');

  return userDataPath;
};

const getTmpDir = () => {
  const rand = randomstring.generate(12);
  const dir = path.join(testDir, rand);

  return dir;
};

const createTmpDir = () => {
  const dir = getTmpDir();

  mkdirp.sync(dir);

  return dir;
};

describe('Electron Settings', () => {

  let tmpDir;

  beforeEach(() => {
    tmpDir = createTmpDir();

    settings.configure({
      dir: tmpDir,
    });
  });

  afterEach('delete user data files', () => {
    rimraf.sync(`${getUserDataPath()}/*`);
    settings.reset();
    tmpDir = null;
  });

  after('delete temp files', () => {
    rimraf.sync(testDir);
  });

  it('should exist', () => {
    assert.ok(settings);
  });

  describe('methods', () => {

    describe('#reset', () => {

      it('should reset configuration to defaults', () => {
        assert.equal(settings.file(), path.join(tmpDir, 'settings.json'));

        settings.reset();

        const userDataPath = getUserDataPath();
        assert.equal(settings.file(), path.join(userDataPath, 'settings.json'));
      });
    });

    describe('#configure', () => {

      it('should update the configuration', () => {
        assert.equal(settings.file(), path.join(tmpDir, 'settings.json'));

        const fileName = 'foo.json';
        settings.configure({ fileName });

        assert.equal(settings.file(), path.join(tmpDir, fileName));
      });
    });

    describe('#file', () => {

      context('by default', () => {

        it('should point to "settings.json" within the app\'s user data directory', () => {
          settings.reset();

          const userDataPath = getUserDataPath();

          assert.equal(settings.file(), path.join(userDataPath, 'settings.json'));
        });
      });

      context('when a custom directory was defined', () => {

        it('should point to "settings.json" within the custom directory', () => {
          assert.equal(settings.file(), path.join(tmpDir, 'settings.json'));
        });
      });

      context('when a custom file name was defined', () => {

        it('should point to the custom file within the app\'s user data directory', () => {
          const fileName = 'foo.json';
          const userDataPath = getUserDataPath();

          settings.reset();
          settings.configure({ fileName });

          assert.equal(settings.file(), path.join(userDataPath, fileName));
        });
      });

      context('when both a custom directory and file name were defined', () => {

        it('should point to the custom file within the custom directory', () => {
          const fileName = 'foo.json';

          settings.configure({ fileName });

          assert.equal(settings.file(), path.join(tmpDir, fileName));
        });
      });
    });

    describe('#get', () => {

      context('when no key path is given', () => {

        it('should get all settings', (done) => {
          fs.writeFile(settings.file(), JSON.stringify({ foo: 'qux' }), (err) => {
            assert.ifError(err);

            settings.get((err, obj) => {
              assert.ifError(err);
              assert.deepStrictEqual(obj, { foo: 'qux' });

              done();
            });
          });
        });
      });

      context('when the key path is a string', () => {

        it('should get the value at the key path', (done) => {
          fs.writeFile(settings.file(), JSON.stringify({ foo: 'qux' }), (err) => {
            assert.ifError(err);

            settings.get('foo', (err, val) => {
              assert.ifError(err);
              assert.deepStrictEqual(val, 'qux');

              done();
            });
          });
        });
      });

      context('when the key path is an escaped string', () => {

        it('should get the value at the key path', (done) => {
          fs.writeFile(settings.file(), JSON.stringify({ 'foo.bar': 'qux' }), (err) => {
            assert.ifError(err);

            settings.get('foo\\.bar', (err, val) => {
              assert.ifError(err);
              assert.deepStrictEqual(val, 'qux');

              done();
            });
          });
        });
      });

      context('when the key path is complex', () => {

        it('should get the value at the key path', (done) => {
          fs.writeFile(settings.file(), JSON.stringify({ foo: { bar: 'qux' } }), (err) => {
            assert.ifError(err);

            settings.get('foo.bar', (err, val) => {
              assert.ifError(err);
              assert.deepStrictEqual(val, 'qux');

              done();
            });
          });
        });
      });

      context('when the key path is an array', () => {

        it('should get the value at the key path', (done) => {
          fs.writeFile(settings.file(), JSON.stringify({ foo: { bar: 'qux' } }), (err) => {
            assert.ifError(err);

            settings.get(['foo', 'bar'], (err, val) => {
              assert.ifError(err);
              assert.deepStrictEqual(val, 'qux');

              done();
            });
          });
        });
      });

      context('when the key path is a nested array', () => {

        it('should get the value at the key path', (done) => {
          fs.writeFile(settings.file(), JSON.stringify({ foo: { bar: { baz: 'qux' } } }), (err) => {
            assert.ifError(err);

            settings.get([['foo', 'bar'], 'baz'], (err, val) => {
              assert.ifError(err);
              assert.deepStrictEqual(val, 'qux');

              done();
            });
          });
        });
      });
    });

    describe('#getSync', () => {

      context('when no key path is given', () => {

        it('should get all settings', () => {
          fs.writeFileSync(settings.file(), JSON.stringify({ foo: 'qux' }));

          const obj = settings.getSync();

          assert.deepStrictEqual(obj, { foo: 'qux' });
        });
      });

      context('when the key path is a string', () => {

        it('should get the value at the key path', () => {
          fs.writeFileSync(settings.file(), JSON.stringify({ foo: 'qux' }));

          const val = settings.getSync('foo');

          assert.deepStrictEqual(val, 'qux');
        });
      });

      context('when the key path is an escaped string', () => {

        it('should get the value at the key path', () => {
          fs.writeFileSync(settings.file(), JSON.stringify({ 'foo.bar': 'qux' }));

          const val = settings.getSync('foo\\.bar');

          assert.deepStrictEqual(val, 'qux');
        });
      });

      context('when the key path is complex', () => {

        it('should get the value at the key path', () => {
          fs.writeFileSync(settings.file(), JSON.stringify({ foo: { bar: 'qux' } }));

          const val = settings.getSync('foo.bar');

          assert.deepStrictEqual(val, 'qux');
        });
      });

      context('when the key path is an array', () => {

        it('should get the value at the key path', () => {
          fs.writeFileSync(settings.file(), JSON.stringify({ foo: { bar: 'qux' } }));

          const val = settings.getSync(['foo', 'bar']);

          assert.deepStrictEqual(val, 'qux');
        });
      });

      context('when the key path is a nested array', () => {

        it('should get the value at the key path', () => {
          fs.writeFileSync(settings.file(), JSON.stringify({ foo: { bar: { baz: 'qux' } } }));

          const val = settings.getSync([['foo', 'bar'], 'baz']);

          assert.deepStrictEqual(val, 'qux');
        });
      });
    });

    describe('#has', () => {

      context('when the key path is a string', () => {

        it('should check if the value at the key path exists', (done) => {
          fs.writeFile(settings.file(), JSON.stringify({ foo: 'qux' }), (err) => {
            assert.ifError(err);

            settings.has('foo', (err, exists) => {
              assert.ifError(err);
              assert.equal(exists, true);

              done();
            });
          });
        });
      });

      context('when the key path is an escaped string', () => {

        it('should check if the value at the key path exists', (done) => {
          fs.writeFile(settings.file(), JSON.stringify({ 'foo.bar': 'qux' }), (err) => {
            assert.ifError(err);

            settings.has('foo\\.bar', (err, exists) => {
              assert.ifError(err);
              assert.equal(exists, true);

              done();
            });
          });
        });
      });

      context('when the key path is complex', () => {

        it('should check if the value at the key path exists', (done) => {
          fs.writeFile(settings.file(), JSON.stringify({ foo: { bar: 'qux' } }), (err) => {
            assert.ifError(err);

            settings.has('foo.bar', (err, exists) => {
              assert.ifError(err);
              assert.equal(exists, true);

              done();
            });
          });
        });
      });

      context('when the key path is an array', () => {

        it('should check if the value at the key path exists', (done) => {
          fs.writeFile(settings.file(), JSON.stringify({ foo: { bar: 'qux' } }), (err) => {
            assert.ifError(err);

            settings.has(['foo', 'bar'], (err, exists) => {
              assert.ifError(err);
              assert.equal(exists, true);

              done();
            });
          });
        });
      });

      context('when the key path is a nested array', () => {

        it('should check if the value at the key path exists', (done) => {
          fs.writeFile(settings.file(), JSON.stringify({ foo: { bar: { baz: 'qux' } } }), (err) => {
            assert.ifError(err);

            settings.has([['foo', 'bar'], 'baz'], (err, exists) => {
              assert.ifError(err);
              assert.equal(exists, true);

              done();
            });
          });
        });
      });

      context('when the key path is invalid', () => {

        it('should throw a TypeError', () => {
          assert.throws(() => {
            settings.has(42, () => {
              assert.fail('Should not have reached here');
            });
          }, /^TypeError: The given key path was not valid$/);
        });
      });
    });

    describe('#hasSync', () => {

      context('when the key path is a string', () => {

        it('should check if the value at the key path exists', () => {
          fs.writeFileSync(settings.file(), JSON.stringify({ foo: 'qux' }));

          const exists = settings.hasSync('foo');

          assert.equal(exists, true);
        });
      });

      context('when the key path is an escaped string', () => {

        it('should check if the value at the key path exists', () => {
          fs.writeFileSync(settings.file(), JSON.stringify({ 'foo.bar': 'qux' }));

          const exists = settings.hasSync('foo\\.bar');

          assert.equal(exists, true);
        });
      });

      context('when the key path is complex', () => {

        it('should check if the value at the key path exists', () => {
          fs.writeFileSync(settings.file(), JSON.stringify({ foo: { bar: 'qux' } }));

          const exists = settings.hasSync('foo.bar');

          assert.equal(exists, true);
        });
      });

      context('when the key path is an array', () => {

        it('should check if the value at the key path exists', () => {
          fs.writeFileSync(settings.file(), JSON.stringify({ foo: { bar: 'qux' } }));

          const exists = settings.hasSync(['foo', 'bar']);

          assert.equal(exists, true);
        });
      });

      context('when the key path is a nested array', () => {

        it('should check if the value at the key path exists', () => {
          fs.writeFileSync(settings.file(), JSON.stringify({ foo: { bar: { baz: 'qux' } } }));

          const exists = settings.hasSync([['foo', 'bar'], 'baz']);

          assert.equal(exists, true);
        });
      });

      context('when the key path is invalid', () => {

        it('should throw a TypeError', () => {
          assert.throws(() => {
            settings.hasSync(42);
          }, /^TypeError: The given key path was not valid$/);
        });
      });
    });

    describe('#set', () => {

      context('when no key path is given', () => {

        it('should set all settings', (done) => {
          fs.writeFile(settings.file(), JSON.stringify({}), (err) => {
            assert.ifError(err);

            settings.set({ foo: 'qux' }, (err) => {
              assert.ifError(err);

              settings.get('foo', (err, val) => {
                assert.ifError(err);
                assert.deepStrictEqual(val, 'qux');

                done();
              });
            });
          });
        });
      });

      context('when the key path is a string', () => {

        it('should set the value at the key path', (done) => {
          fs.writeFile(settings.file(), JSON.stringify({}), (err) => {
            assert.ifError(err);

            settings.set('foo', 'qux', (err) => {
              assert.ifError(err);

              settings.get('foo', (err, val) => {
                assert.ifError(err);
                assert.deepStrictEqual(val, 'qux');

                done();
              });
            });
          });
        });
      });

      context('when the key path is an escaped string', () => {

        it('should set the value at the key path', (done) => {
          fs.writeFile(settings.file(), JSON.stringify({}), (err) => {
            assert.ifError(err);

            settings.set('foo\\.bar', 'qux', (err) => {
              assert.ifError(err);

              settings.get('foo\\.bar', (err, val) => {
                assert.ifError(err);
                assert.deepStrictEqual(val, 'qux');

                done();
              });
            });
          });
        });
      });

      context('when the key path is complex', () => {

        it('should set the value the key path', (done) => {
          fs.writeFile(settings.file(), JSON.stringify({}), (err) => {
            assert.ifError(err);

            settings.set('foo.bar', 'qux', (err) => {
              assert.ifError(err);

              settings.get('foo.bar', (err, val) => {
                assert.ifError(err);
                assert.deepStrictEqual(val, 'qux');

                done();
              });
            });
          });
        });
      });

      context('when the key path is an array', () => {

        it('should set the value at the key path', (done) => {
          fs.writeFile(settings.file(), JSON.stringify({}), (err) => {
            assert.ifError(err);

            settings.set(['foo', 'bar'], 'qux', (err) => {
              assert.ifError(err);

              settings.get('foo.bar', (err, val) => {
                assert.ifError(err);
                assert.deepStrictEqual(val, 'qux');

                done();
              });
            });
          });
        });
      });

      context('when the key path is a nested array', () => {

        it('should set the value at the key path', (done) => {
          fs.writeFile(settings.file(), JSON.stringify({}), (err) => {
            assert.ifError(err);

            settings.set([['foo', 'bar'], 'baz'], 'qux', (err) => {
              assert.ifError(err);

              settings.get('foo.bar.baz', (err, val) => {
                assert.ifError(err);
                assert.deepStrictEqual(val, 'qux');

                done();
              });
            });
          });
        });
      });
    });

    describe('#setSync', () => {

      context('when no key path is given', () => {

        it('should set all settings', () => {
          fs.writeFileSync(settings.file(), JSON.stringify({}));

          settings.setSync({ foo: 'qux' });

          const val = settings.getSync('foo');

          assert.deepStrictEqual(val, 'qux');
        });
      });

      context('when the key path is a string', () => {

        it('should set the value at the key path', () => {
          fs.writeFileSync(settings.file(), JSON.stringify({}));

          settings.setSync('foo', 'qux');

          const val = settings.getSync('foo');

          assert.deepStrictEqual(val, 'qux');
        });
      });

      context('when the key path is an escaped string', () => {

        it('should set the value at the key path', () => {
          fs.writeFileSync(settings.file(), JSON.stringify({}));

          settings.setSync('foo\\.bar', 'qux');

          const val = settings.getSync('foo\\.bar');

          assert.deepStrictEqual(val, 'qux');
        });
      });

      context('when the key path is complex', () => {

        it('should set the value the key path', () => {
          fs.writeFileSync(settings.file(), JSON.stringify({}));

          settings.setSync('foo.bar', 'qux');

          const val = settings.getSync('foo.bar');

          assert.deepStrictEqual(val, 'qux');
        });
      });

      context('when the key path is an array', () => {

        it('should set the value at the key path', () => {
          fs.writeFileSync(settings.file(), JSON.stringify({}));

          settings.setSync(['foo', 'bar'], 'qux');

          const val = settings.getSync('foo.bar');

          assert.deepStrictEqual(val, 'qux');
        });
      });

      context('when the key path is a nested array', () => {

        it('should set the value at the key path', () => {
          fs.writeFileSync(settings.file(), JSON.stringify({}));

          settings.setSync([['foo', 'bar'], 'baz'], 'qux');

          const val = settings.getSync('foo.bar.baz');

          assert.deepStrictEqual(val, 'qux');
        });
      });
    });

    describe('#delete', () => {

      context('when the key path is a string', () => {

        it('should delete the value at the key path', (done) => {
          fs.writeFile(settings.file(), JSON.stringify({}), (err) => {
            assert.ifError(err);

            settings.delete('foo', (err) => {
              assert.ifError(err);

              settings.has('foo', (err, exists) => {
                assert.ifError(err);
                assert.equal(exists, false);

                done();
              });
            });
          });
        });
      });

      context('when the key path is an escaped string', () => {

        it('should delete the value at the key path', (done) => {
          fs.writeFile(settings.file(), JSON.stringify({}), (err) => {
            assert.ifError(err);

            settings.delete('foo\\.bar', (err) => {
              assert.ifError(err);

              settings.has('foo\\.bar', (err, exists) => {
                assert.ifError(err);
                assert.equal(exists, false);

                done();
              });
            });
          });
        });
      });

      context('when the key path is complex', () => {

        it('should delete the value at the key path', (done) => {
          fs.writeFile(settings.file(), JSON.stringify({}), (err) => {
            assert.ifError(err);

            settings.delete('foo.bar', (err) => {
              assert.ifError(err);

              settings.has('foo.bar', (err, exists) => {
                assert.ifError(err);
                assert.equal(exists, false);

                done();
              });
            });
          });
        });
      });

      context('when the key path is an array', () => {

        it('should delete the value at the key path', (done) => {
          fs.writeFile(settings.file(), JSON.stringify({}), (err) => {
            assert.ifError(err);

            settings.delete(['foo', 'bar'], (err) => {
              assert.ifError(err);

              settings.has('foo.bar', (err, exists) => {
                assert.ifError(err);
                assert.equal(exists, false);

                done();
              });
            });
          });
        });
      });

      context('when the key path is a nested array', () => {

        it('should delete the value at the key path', (done) => {
          fs.writeFile(settings.file(), JSON.stringify({}), (err) => {
            assert.ifError(err);

            settings.delete([['foo', 'bar'], 'baz'], (err) => {
              assert.ifError(err);

              settings.has('foo.bar.baz', (err, exists) => {
                assert.ifError(err);
                assert.equal(exists, false);

                done();
              });
            });
          });
        });
      });

      context('when the key path is invalid', () => {

        it('should throw a TypeError', () => {
          assert.throws(() => {
            settings.delete(42, () => {
              assert.fail('Should not have reached here');
            });
          }, /^TypeError: The given key path was not valid$/);
        });
      });
    });

    describe('#deleteSync', () => {

      context('when the key path is a string', () => {

        it('should delete the value at the key path', () => {
          settings.setSync('foo', 'qux');
          settings.deleteSync('foo');

          const exists = settings.hasSync('foo');

          assert.equal(exists, false);
        });
      });

      context('when the key path is an escaped string', () => {

        it('should delete the value at the key path', () => {
          settings.setSync('foo\\.bar', 'qux');
          settings.deleteSync('foo\\.bar');

          const exists = settings.hasSync('foo\\.bar');

          assert.equal(exists, false);
        });
      });

      context('when the key path is complex', () => {

        it('should delete the value at the key path', () => {
          settings.setSync('foo.bar', 'qux');
          settings.deleteSync('foo.bar');

          const exists = settings.hasSync('foo.bar');

          assert.equal(exists, false);
        });
      });

      context('when the key path is an array', () => {

        it('should delete the value at the key path', () => {
          settings.setSync(['foo', 'bar'], 'qux');
          settings.deleteSync(['foo', 'bar']);

          const exists = settings.hasSync('foo.bar');

          assert.equal(exists, false);
        });
      });

      context('when the key path is a nested array', () => {

        it('should delete the value at the key path', () => {
          settings.setSync([['foo', 'bar'], 'baz'], 'qux');
          settings.deleteSync([['foo', 'bar'], 'baz']);

          const exists = settings.hasSync('foo.bar.baz');

          assert.equal(exists, false);
        });
      });

      context('when the key path is invalid', () => {

        it('should throw a TypeError', () => {
          assert.throws(() => {
            settings.deleteSync(42);
          }, /^TypeError: The given key path was not valid$/);
        });
      });
    });
  });

  describe('options', () => {

    describe('atomicSave', () => {

      context('when not given', () => {

        it('should save atomically', (done) => {
          settings.set('foo', 'bar', (err) => {
            assert.ifError(err);

            done();
          });
        });

        it('should save atomically synchronously', () => {
          settings.setSync('foo', 'bar');
        });
      });

      context('when false', () => {

        it('should not save atomically', (done) => {
          settings.set('foo', 'bar', (err) => {
            assert.ifError(err);

            done();
          });
        });

        it('should not save atomically synchronously', () => {
          settings.setSync('foo', 'bar');
        });
      });
    });

    describe('dir', () => {

      context('when not given', () => {

        it('should save to the user data path', (done) => {
          const filePath = path.join(getUserDataPath(), 'settings.json');

          settings.reset();

          assert.deepStrictEqual(filePath, settings.file());

          settings.set('foo', 'bar', (err) => {
            assert.ifError(err);

            // If this errors, then the file does not exist.
            fs.stat(filePath, (err) => {
              assert.ifError(err);

              done();
            });
          });
        });
      });

      context('when given', () => {

        it('should save to the given directory', (done) => {
          const dir = createTmpDir();
          const filePath = path.join(dir, 'settings.json');

          settings.configure({ dir });

          assert.deepStrictEqual(filePath, settings.file());

          settings.set('foo', 'bar', (err) => {
            assert.ifError(err);

            // If this errors, then the file does not exist.
            fs.stat(filePath, (err) => {
              assert.ifError(err);

              done();
            });
          });
        });

        it('should create the given directory if it does not exist', (done) => {
          const dir = createTmpDir();
          const filePath = path.join(dir, 'settings.json');

          settings.configure({ dir });

          settings.set('foo', 'bar', (err) => {
            assert.ifError(err);

            // If this errors, then the file does not exist.
            fs.stat(filePath, (err) => {
              assert.ifError(err);

              done();
            });
          });
        });

        it('should create the given directory synchronously if it does not exist', () => {
          const dir = createTmpDir();
          const filePath = path.join(dir, 'settings.json');

          settings.configure({ dir });
          settings.setSync('foo', 'bar');

          // If this throws, then the file does not exist.
          fs.statSync(filePath);
        });
      });
    });

    describe('encryptionAlgorithm', () => {

      context('when not given', () => {

        it('should encrypt the output using aes-256-cbc', (done) => {
          const encryptionKey = 'foobar';

          settings.configure({ encryptionKey });

          settings.set('foo', 'bar', (err) => {
            assert.ifError(err);

            fs.readFile(settings.file(), (err, buffer) => {
              assert.ifError(err);

              const decipher = crypto.createDecipher('aes-256-cbc', encryptionKey);
              const dec = Buffer.concat([decipher.update(buffer), decipher.final()]);

              assert.ok(/^{"foo":"bar"}$/.test(dec.toString('utf8')));

              done();
            });
          });
        });

        it('should encrypt the output synchronously using aes-256-cbc', () => {
          const encryptionKey = 'foobar';

          settings.configure({ encryptionKey });
          settings.setSync('foo', 'bar');

          const buffer = fs.readFileSync(settings.file());
          const decipher = crypto.createDecipher('aes-256-cbc', encryptionKey);
          const dec = Buffer.concat([decipher.update(buffer), decipher.final()]);

          assert.ok(/^{"foo":"bar"}$/.test(dec.toString('utf8')));
        });
      });

      context('when des-cbc', () => {

        it('should encrypt the output using des-cbc when saving', (done) => {
          const encryptionAlgorithm = 'des-cbc';
          const encryptionKey = 'foobar';

          settings.configure({ encryptionAlgorithm, encryptionKey });

          settings.set('foo', 'bar', (err) => {
            assert.ifError(err);

            fs.readFile(settings.file(), (err, buffer) => {
              assert.ifError(err);

              const decipher = crypto.createDecipher(encryptionAlgorithm, encryptionKey);
              const dec = Buffer.concat([decipher.update(buffer), decipher.final()]);

              assert.ok(/^{"foo":"bar"}$/.test(dec.toString('utf8')));

              done();
            });
          });
        });

        it('should encrypt the output synchronously using des-cbc when saving', () => {
          const encryptionAlgorithm = 'des-cbc';
          const encryptionKey = 'foobar';

          settings.configure({ encryptionAlgorithm, encryptionKey });
          settings.setSync('foo', 'bar');

          const buffer = fs.readFileSync(settings.file());
          const decipher = crypto.createDecipher(encryptionAlgorithm, encryptionKey);
          const dec = Buffer.concat([decipher.update(buffer), decipher.final()]);

          assert.ok(/^{"foo":"bar"}$/.test(dec.toString('utf8')));
        });
      });
    });

    describe('encryptionKey', () => {

      context('when not given', () => {

        it('should not encrypt the output when saving', (done) => {
          settings.set('foo', 'bar', (err) => {
            assert.ifError(err);

            fs.readFile(settings.file(), 'utf-8', (err, data) => {
              assert.ifError(err);

              assert.ok(/^{"foo":"bar"}$/.test(data));

              done();
            });
          });
        });

        it('should not encrypt the output synchronously when saving', () => {
          settings.setSync('foo', 'bar');

          const data = fs.readFileSync(settings.file(), 'utf-8');

          assert.ok(/^{"foo":"bar"}$/.test(data));
        });
      });

      context('when given', () => {

        it('should encrypt the output when saving', (done) => {
          const encryptionKey = 'foobar';

          settings.configure({ encryptionKey });

          settings.set('foo', 'bar', (err) => {
            assert.ifError(err);

            fs.readFile(settings.file(), (err, buffer) => {
              assert.ifError(err);

              const decipher = crypto.createDecipher('aes-256-cbc', encryptionKey);
              const dec = Buffer.concat([decipher.update(buffer), decipher.final()]);

              assert.ok(/^{"foo":"bar"}$/.test(dec.toString('utf8')));

              done();
            });
          });
        });

        it('should encrypt the output synchronously when saving', () => {
          const encryptionKey = 'foobar';

          settings.configure({ encryptionKey });
          settings.setSync('foo', 'bar');

          const buffer = fs.readFileSync(settings.file());
          const decipher = crypto.createDecipher('aes-256-cbc', encryptionKey);
          const dec = Buffer.concat([decipher.update(buffer), decipher.final()]);

          assert.ok(/^{"foo":"bar"}$/.test(dec.toString('utf8')));
        });
      });
    });

    describe('fileName', () => {

      context('when not given', () => {

        it('should save to "settings.json"', (done) => {
          assert.deepStrictEqual(settings.file(), path.join(tmpDir, 'settings.json'));

          settings.set('foo', 'bar', (err) => {
            assert.ifError(err);

            fs.readFile(path.join(tmpDir, 'settings.json'), 'utf-8', (err, data) => {
              assert.ifError(err);
              assert.ok(/^{"foo":"bar"}$/.test(data));

              done();
            });
          });
        });
      });

      context('when "test.json"', () => {

        it('should save to "test.json"', (done) => {
          const fileName = 'test.json';

          settings.configure({ fileName });

          assert.deepStrictEqual(settings.file(), path.join(tmpDir, fileName));

          settings.set('foo', 'bar', (err) => {
            assert.ifError(err);

            fs.readFile(path.join(tmpDir, fileName), 'utf-8', (err, data) => {
              assert.ifError(err);
              assert.ok(/^{"foo":"bar"}$/.test(data));

              done();
            });
          });
        });
      });
    });

    describe('prettify', () => {

      context('when not given', () => {

        it('should not prettify the output when saving', (done) => {
          settings.set('foo', 'bar', (err) => {
            assert.ifError(err);

            fs.readFile(settings.file(), 'utf-8', (err, data) => {
              assert.ifError(err);
              assert.ok(/^{"foo":"bar"}$/.test(data));

              done();
            });
          });
        });
      });

      context('when true', () => {

        it('should prettify the output when saving', (done) => {
          settings.configure({ prettify: true });

          settings.set('foo', 'bar', (err) => {
            assert.ifError(err);

            fs.readFile(settings.file(), 'utf-8', (err, data) => {
              assert.ifError(err);
              assert.ok(/^{\n\s+"foo":\s"bar"\n}$/.test(data));

              done();
            });
          });
        });
      });
    });

    describe('numSpaces', () => {

      context('when not given', () => {

        it('should prettify the output with two spaces when saving', (done) => {
          settings.configure({ prettify: true, numSpaces: 2 });

          settings.set('foo', 'bar', (err) => {
            assert.ifError(err);

            fs.readFile(settings.file(), 'utf-8', (err, data) => {
              assert.ifError(err);
              assert.ok(/^{\n(\s){2}"foo": "bar"\n}$/.test(data));

              done();
            });
          });
        });
      });

      context('when 4', () => {

        it('should prettify the output with four spaces when saving', (done) => {
          settings.configure({ prettify: true, numSpaces: 4 });

          settings.set('foo', 'bar', (err) => {
            assert.ifError(err);

            fs.readFile(settings.file(), 'utf-8', (err, data) => {
              assert.ifError(err);
              assert.ok(/^{\n(\s){4}"foo": "bar"\n}$/.test(data));

              done();
            });
          });
        });
      });
    });
  });
});
