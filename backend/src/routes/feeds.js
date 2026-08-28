const express = require('express');
const { generateJobsFeedXml, recordFeedPull } = require('../services/feed');

const router = express.Router();

router.get('/jobs.xml', async (req, res, next) => {
  try {
    const xml = await generateJobsFeedXml();
    // Fire-and-forget: never let a logging failure break the feed for Jobit.
    recordFeedPull({
      userAgent: req.get('user-agent') || null,
      ip: req.ip || null,
    }).catch(() => {});
    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.set('Cache-Control', 'no-cache, max-age=0');
    return res.status(200).send(xml);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
