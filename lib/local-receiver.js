'use strict';

var concat = require('concat-stream');
var crypto = require('crypto');
var debug = require('debug')('strong-deploy-receiver:local-deploy');
var fs = require('fs');
var path = require('path');
var serverCommit = require('strong-fork-cicada/lib/commit');

module.exports = function(cicada) {
  var r = new LocalReceiver(cicada);
  r.handle = r.handle.bind(r);
  return r;
};

function LocalReceiver(_cicada) {
  this._cicada = _cicada;
}

LocalReceiver.prototype.sendError = function(res, err) {
  debug('error 400: %s', err);
  res.writeHead(400);
  res.end('Local deploy failed: ' + err);
};

LocalReceiver.prototype.processLocalDir = function(req, res, dirPath, hash) {
  var id = hash + '.' + Date.now();

  var repo = path.basename(dirPath);

  debug('processLocalDir: id=%s dir=%s repo=%s branch=%s',
        id, dirPath, repo, branch);

  var branch = 'local-directory';

  var commit = serverCommit({
    hash: hash, id: id, dir: dirPath, repo: repo, branch: branch
  });

  commit.runInPlace = true;

  debug('commit: %j', commit);
  this._cicada.emit('commit', commit);
  res.writeHead(200);
  res.end('Application deployed\n');
};

LocalReceiver.prototype.computeHash = function(req, res, dirPath) {
  var shasum = crypto.createHash('sha1');
  var self = this;

  shasum.update(dirPath);
  fs.stat(dirPath, function(err, stats) {
    if (err) {
      return self.sendError(res, '`' + dirPath + '` does not exist');
    }
    if (!stats.isDirectory()) {
      return self.sendError(res, '`' + dirPath + '` is not a directory');
    }

    var hash = shasum.digest('hex');
    self.processLocalDir(req, res, dirPath, hash);
  });
};

LocalReceiver.prototype.handle = function(req, res) {
  var self = this;

  req.pipe(concat(function(postData) {
    debug('%s', postData);
    try {
      var postObj = JSON.parse(postData);
      if (!postObj.hasOwnProperty('local-directory')) {
        return self.sendError(res, 'local directory not specified');
      }

      self.computeHash(req, res, postObj['local-directory']);
    } catch (err) {
      return self.sendError(res, 'error parsing request: ' + err.message);
    }
  }));

  req.on('error', function(err) {
    self.sendError(req, res, err);
  });
};
