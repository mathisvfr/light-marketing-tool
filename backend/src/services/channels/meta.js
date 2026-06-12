const { publishFacebookInstagram } = require('../meta');

async function publish(content) {
  return publishFacebookInstagram(content);
}

module.exports = {
  publish,
};
