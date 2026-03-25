// Step 123: Static field schema for RollerAds API

import type { RollerAdsFieldSchema } from './types';

export const ROLLERADS_FIELD_SCHEMA: RollerAdsFieldSchema[] = [
  {
    field: 'site_id',
    type: 'string',
    description: 'Unique identifier for the publisher site',
  },
  {
    field: 'date',
    type: 'string',
    description: 'Date of the statistics in YYYY-MM-DD format',
  },
  {
    field: 'country',
    type: 'string',
    description: 'ISO 3166-1 alpha-2 country code for the traffic origin',
  },
  {
    field: 'impressions',
    type: 'number',
    description: 'Total number of ad impressions served',
  },
  {
    field: 'clicks',
    type: 'number',
    description: 'Total number of clicks on ads',
  },
  {
    field: 'ctr',
    type: 'number',
    description: 'Click-through rate (clicks / impressions * 100)',
  },
  {
    field: 'revenue',
    type: 'number',
    description: 'Publisher revenue earned in USD',
  },
  {
    field: 'cpm',
    type: 'number',
    description: 'Cost per thousand impressions in USD',
  },
  {
    field: 'ecpm',
    type: 'number',
    description: 'Effective cost per thousand impressions in USD',
  },
];
