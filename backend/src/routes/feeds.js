const express = require('express');
const { generateJobsFeedXml, getJobsFeedStatus } = require('../services/feed');

const router = express.Router();

router.get('/jobs.xml', async (_req, res, next) => {
  try {
    const xml = await generateJobsFeedXml();
    res.set('Content-Type', 'application/xml; charset=utf-8');
    return res.status(200).send(xml);
  } catch (error) {
    return next(error);
  }
});

router.get('/status', async (_req, res, next) => {
  try {
    const status = await getJobsFeedStatus();
    return res.status(200).json(status);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
