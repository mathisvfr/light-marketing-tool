const NOT_CONFIGURED_ERROR =
  'Nieuwe website-koppeling is nog niet geconfigureerd. Publicatie is tijdelijk niet beschikbaar.';

async function publish() {
  return {
    status: 'failed',
    externalId: null,
    error: NOT_CONFIGURED_ERROR,
  };
}

async function expire() {
  return { attempted: 0 };
}

module.exports = {
  publish,
  expire,
  NOT_CONFIGURED_ERROR,
};
