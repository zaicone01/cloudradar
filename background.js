(function () {
  'use strict';

  var CHECK_INTERVAL_MINUTES = 5;
  var STORAGE_KEY  = 'cr_cache';
  var HISTORY_KEY  = 'cr_history';
  // BUG FIX #5: MAX_HISTORY era 168 (cubre solo ~14h a 5min/check).
  // Para cubrir 48h reales se necesitan 48*60/5 = 576 entradas.
  var MAX_HISTORY  = 576;
  var _checkRunning = false;

  // ─── AWS REGIONS ──────────────────────────────────────────────────────────────
  var AWS_REGIONS = [
    { id:'us-east-1',      name:'US East (N. Virginia)',       code:'us-east-1',      cat:'North America',  flag:'🇺🇸', provider:'aws', type:'statuspage', url:'https://health.aws.amazon.com/health/status', statusPageUrl:'https://health.aws.amazon.com/health/status' },
    { id:'us-east-2',      name:'US East (Ohio)',              code:'us-east-2',      cat:'North America',  flag:'🇺🇸', provider:'aws', type:'statuspage', url:'https://health.aws.amazon.com/health/status', statusPageUrl:'https://health.aws.amazon.com/health/status' },
    { id:'us-west-1',      name:'US West (N. California)',     code:'us-west-1',      cat:'North America',  flag:'🇺🇸', provider:'aws', type:'statuspage', url:'https://health.aws.amazon.com/health/status', statusPageUrl:'https://health.aws.amazon.com/health/status' },
    { id:'us-west-2',      name:'US West (Oregon)',            code:'us-west-2',      cat:'North America',  flag:'🇺🇸', provider:'aws', type:'statuspage', url:'https://health.aws.amazon.com/health/status', statusPageUrl:'https://health.aws.amazon.com/health/status' },
    { id:'ca-central-1',   name:'Canada (Central)',            code:'ca-central-1',   cat:'North America',  flag:'🇨🇦', provider:'aws', type:'statuspage', url:'https://health.aws.amazon.com/health/status', statusPageUrl:'https://health.aws.amazon.com/health/status' },
    { id:'ca-west-1',      name:'Canada West (Calgary)',       code:'ca-west-1',      cat:'North America',  flag:'🇨🇦', provider:'aws', type:'statuspage', url:'https://health.aws.amazon.com/health/status', statusPageUrl:'https://health.aws.amazon.com/health/status' },
    { id:'mx-central-1',   name:'Mexico (Central)',            code:'mx-central-1',   cat:'North America',  flag:'🇲🇽', provider:'aws', type:'statuspage', url:'https://health.aws.amazon.com/health/status', statusPageUrl:'https://health.aws.amazon.com/health/status' },
    { id:'sa-east-1',      name:'South America (São Paulo)',   code:'sa-east-1',      cat:'South America',     flag:'🇧🇷', provider:'aws', type:'statuspage', url:'https://health.aws.amazon.com/health/status', statusPageUrl:'https://health.aws.amazon.com/health/status' },
    { id:'eu-west-1',      name:'Europe (Ireland)',            code:'eu-west-1',      cat:'Europe',         flag:'🇮🇪', provider:'aws', type:'statuspage', url:'https://health.aws.amazon.com/health/status', statusPageUrl:'https://health.aws.amazon.com/health/status' },
    { id:'eu-west-2',      name:'Europe (London)',             code:'eu-west-2',      cat:'Europe',         flag:'🇬🇧', provider:'aws', type:'statuspage', url:'https://health.aws.amazon.com/health/status', statusPageUrl:'https://health.aws.amazon.com/health/status' },
    { id:'eu-west-3',      name:'Europe (Paris)',              code:'eu-west-3',      cat:'Europe',         flag:'🇫🇷', provider:'aws', type:'statuspage', url:'https://health.aws.amazon.com/health/status', statusPageUrl:'https://health.aws.amazon.com/health/status' },
    { id:'eu-central-1',   name:'Europe (Frankfurt)',          code:'eu-central-1',   cat:'Europe',         flag:'🇩🇪', provider:'aws', type:'statuspage', url:'https://health.aws.amazon.com/health/status', statusPageUrl:'https://health.aws.amazon.com/health/status' },
    { id:'eu-central-2',   name:'Europe (Zurich)',             code:'eu-central-2',   cat:'Europe',         flag:'🇨🇭', provider:'aws', type:'statuspage', url:'https://health.aws.amazon.com/health/status', statusPageUrl:'https://health.aws.amazon.com/health/status' },
    { id:'eu-north-1',     name:'Europe (Stockholm)',          code:'eu-north-1',     cat:'Europe',         flag:'🇸🇪', provider:'aws', type:'statuspage', url:'https://health.aws.amazon.com/health/status', statusPageUrl:'https://health.aws.amazon.com/health/status' },
    { id:'eu-south-1',     name:'Europe (Milan)',              code:'eu-south-1',     cat:'Europe',         flag:'🇮🇹', provider:'aws', type:'statuspage', url:'https://health.aws.amazon.com/health/status', statusPageUrl:'https://health.aws.amazon.com/health/status' },
    { id:'eu-south-2',     name:'Europe (Spain)',              code:'eu-south-2',     cat:'Europe',         flag:'🇪🇸', provider:'aws', type:'statuspage', url:'https://health.aws.amazon.com/health/status', statusPageUrl:'https://health.aws.amazon.com/health/status' },
    { id:'me-south-1',     name:'Middle East (Bahrain)',       code:'me-south-1',     cat:'Middle East',  flag:'🇧🇭', provider:'aws', type:'statuspage', url:'https://health.aws.amazon.com/health/status', statusPageUrl:'https://health.aws.amazon.com/health/status' },
    { id:'me-central-1',   name:'Middle East (UAE)',           code:'me-central-1',   cat:'Middle East',  flag:'🇦🇪', provider:'aws', type:'statuspage', url:'https://health.aws.amazon.com/health/status', statusPageUrl:'https://health.aws.amazon.com/health/status' },
    { id:'il-central-1',   name:'Israel (Tel Aviv)',           code:'il-central-1',   cat:'Middle East',  flag:'🇮🇱', provider:'aws', type:'statuspage', url:'https://health.aws.amazon.com/health/status', statusPageUrl:'https://health.aws.amazon.com/health/status' },
    { id:'af-south-1',     name:'Africa (Cape Town)',          code:'af-south-1',     cat:'Africa',         flag:'🇿🇦', provider:'aws', type:'statuspage', url:'https://health.aws.amazon.com/health/status', statusPageUrl:'https://health.aws.amazon.com/health/status' },
    { id:'ap-east-1',      name:'Asia Pacific (Hong Kong)',    code:'ap-east-1',      cat:'Asia Pacific',  flag:'🇭🇰', provider:'aws', type:'statuspage', url:'https://health.aws.amazon.com/health/status', statusPageUrl:'https://health.aws.amazon.com/health/status' },
    { id:'ap-south-1',     name:'Asia Pacific (Mumbai)',       code:'ap-south-1',     cat:'Asia Pacific',  flag:'🇮🇳', provider:'aws', type:'statuspage', url:'https://health.aws.amazon.com/health/status', statusPageUrl:'https://health.aws.amazon.com/health/status' },
    { id:'ap-south-2',     name:'Asia Pacific (Hyderabad)',    code:'ap-south-2',     cat:'Asia Pacific',  flag:'🇮🇳', provider:'aws', type:'statuspage', url:'https://health.aws.amazon.com/health/status', statusPageUrl:'https://health.aws.amazon.com/health/status' },
    { id:'ap-northeast-1', name:'Asia Pacific (Tokyo)',        code:'ap-northeast-1', cat:'Asia Pacific',  flag:'🇯🇵', provider:'aws', type:'statuspage', url:'https://health.aws.amazon.com/health/status', statusPageUrl:'https://health.aws.amazon.com/health/status' },
    { id:'ap-northeast-2', name:'Asia Pacific (Seoul)',        code:'ap-northeast-2', cat:'Asia Pacific',  flag:'🇰🇷', provider:'aws', type:'statuspage', url:'https://health.aws.amazon.com/health/status', statusPageUrl:'https://health.aws.amazon.com/health/status' },
    { id:'ap-northeast-3', name:'Asia Pacific (Osaka)',        code:'ap-northeast-3', cat:'Asia Pacific',  flag:'🇯🇵', provider:'aws', type:'statuspage', url:'https://health.aws.amazon.com/health/status', statusPageUrl:'https://health.aws.amazon.com/health/status' },
    { id:'ap-southeast-1', name:'Asia Pacific (Singapore)',    code:'ap-southeast-1', cat:'Asia Pacific',  flag:'🇸🇬', provider:'aws', type:'statuspage', url:'https://health.aws.amazon.com/health/status', statusPageUrl:'https://health.aws.amazon.com/health/status' },
    { id:'ap-southeast-2', name:'Asia Pacific (Sydney)',       code:'ap-southeast-2', cat:'Australia & NZ', flag:'🇦🇺', provider:'aws', type:'statuspage', url:'https://health.aws.amazon.com/health/status', statusPageUrl:'https://health.aws.amazon.com/health/status' },
    { id:'ap-southeast-3', name:'Asia Pacific (Jakarta)',      code:'ap-southeast-3', cat:'Asia Pacific',  flag:'🇮🇩', provider:'aws', type:'statuspage', url:'https://health.aws.amazon.com/health/status', statusPageUrl:'https://health.aws.amazon.com/health/status' },
    { id:'ap-southeast-4', name:'Asia Pacific (Melbourne)',    code:'ap-southeast-4', cat:'Australia & NZ', flag:'🇦🇺', provider:'aws', type:'statuspage', url:'https://health.aws.amazon.com/health/status', statusPageUrl:'https://health.aws.amazon.com/health/status' },
    { id:'ap-southeast-5', name:'Asia Pacific (Malaysia)',     code:'ap-southeast-5', cat:'Asia Pacific',  flag:'🇲🇾', provider:'aws', type:'statuspage', url:'https://health.aws.amazon.com/health/status', statusPageUrl:'https://health.aws.amazon.com/health/status' },
    { id:'ap-southeast-7', name:'Asia Pacific (Thailand)',     code:'ap-southeast-7', cat:'Asia Pacific',  flag:'🇹🇭', provider:'aws', type:'statuspage', url:'https://health.aws.amazon.com/health/status', statusPageUrl:'https://health.aws.amazon.com/health/status' }
  ];

  // ─── GCP REGIONS ──────────────────────────────────────────────────────────────
  var GCP_REGIONS = [
    { id:'gcp-us-central1',       name:'GCP Iowa',                code:'us-central1',            cat:'North America',  flag:'🇺🇸', provider:'gcp', statusPageUrl:'https://status.cloud.google.com' },
    { id:'gcp-us-east1',          name:'GCP S. Carolina',         code:'us-east1',               cat:'North America',  flag:'🇺🇸', provider:'gcp', statusPageUrl:'https://status.cloud.google.com' },
    { id:'gcp-us-east4',          name:'GCP N. Virginia',         code:'us-east4',               cat:'North America',  flag:'🇺🇸', provider:'gcp', statusPageUrl:'https://status.cloud.google.com' },
    { id:'gcp-us-west1',          name:'GCP Oregon',              code:'us-west1',               cat:'North America',  flag:'🇺🇸', provider:'gcp', statusPageUrl:'https://status.cloud.google.com' },
    { id:'gcp-us-west2',          name:'GCP Los Angeles',         code:'us-west2',               cat:'North America',  flag:'🇺🇸', provider:'gcp', statusPageUrl:'https://status.cloud.google.com' },
    { id:'gcp-northamerica-ne1',  name:'GCP Montréal',            code:'northamerica-northeast1', cat:'North America', flag:'🇨🇦', provider:'gcp', statusPageUrl:'https://status.cloud.google.com' },
    { id:'gcp-southamerica-e1',   name:'GCP São Paulo',           code:'southamerica-east1',     cat:'South America',     flag:'🇧🇷', provider:'gcp', statusPageUrl:'https://status.cloud.google.com' },
    { id:'gcp-europe-west1',      name:'GCP Belgium',             code:'europe-west1',           cat:'Europe',         flag:'🇧🇪', provider:'gcp', statusPageUrl:'https://status.cloud.google.com' },
    { id:'gcp-europe-west2',      name:'GCP London',              code:'europe-west2',           cat:'Europe',         flag:'🇬🇧', provider:'gcp', statusPageUrl:'https://status.cloud.google.com' },
    { id:'gcp-europe-west3',      name:'GCP Frankfurt',           code:'europe-west3',           cat:'Europe',         flag:'🇩🇪', provider:'gcp', statusPageUrl:'https://status.cloud.google.com' },
    { id:'gcp-europe-west4',      name:'GCP Netherlands',         code:'europe-west4',           cat:'Europe',         flag:'🇳🇱', provider:'gcp', statusPageUrl:'https://status.cloud.google.com' },
    { id:'gcp-europe-north1',     name:'GCP Finland',             code:'europe-north1',          cat:'Europe',         flag:'🇫🇮', provider:'gcp', statusPageUrl:'https://status.cloud.google.com' },
    { id:'gcp-me-west1',          name:'GCP Tel Aviv',            code:'me-west1',               cat:'Middle East',  flag:'🇮🇱', provider:'gcp', statusPageUrl:'https://status.cloud.google.com' },
    { id:'gcp-asia-east1',        name:'GCP Taiwan',              code:'asia-east1',             cat:'Asia Pacific',  flag:'🇹🇼', provider:'gcp', statusPageUrl:'https://status.cloud.google.com' },
    { id:'gcp-asia-northeast1',   name:'GCP Tokyo',               code:'asia-northeast1',        cat:'Asia Pacific',  flag:'🇯🇵', provider:'gcp', statusPageUrl:'https://status.cloud.google.com' },
    { id:'gcp-asia-northeast3',   name:'GCP Seoul',               code:'asia-northeast3',        cat:'Asia Pacific',  flag:'🇰🇷', provider:'gcp', statusPageUrl:'https://status.cloud.google.com' },
    { id:'gcp-asia-south1',       name:'GCP Mumbai',              code:'asia-south1',            cat:'Asia Pacific',  flag:'🇮🇳', provider:'gcp', statusPageUrl:'https://status.cloud.google.com' },
    { id:'gcp-asia-southeast1',   name:'GCP Singapore',           code:'asia-southeast1',        cat:'Asia Pacific',  flag:'🇸🇬', provider:'gcp', statusPageUrl:'https://status.cloud.google.com' },
    { id:'gcp-australia-se1',     name:'GCP Sydney',              code:'australia-southeast1',   cat:'Australia & NZ', flag:'🇦🇺', provider:'gcp', statusPageUrl:'https://status.cloud.google.com' }
  ];

  // ─── AZURE REGIONS ────────────────────────────────────────────────────────────
  var AZURE_REGIONS = [
    { id:'az-eastus',          name:'East US',            code:'eastus',          cat:'North America',  flag:'🇺🇸', provider:'azure', statusPageUrl:'https://azure.status.microsoft/en-us/status' },
    { id:'az-eastus2',         name:'East US 2',          code:'eastus2',         cat:'North America',  flag:'🇺🇸', provider:'azure', statusPageUrl:'https://azure.status.microsoft/en-us/status' },
    { id:'az-westus',          name:'West US',            code:'westus',          cat:'North America',  flag:'🇺🇸', provider:'azure', statusPageUrl:'https://azure.status.microsoft/en-us/status' },
    { id:'az-westus2',         name:'West US 2',          code:'westus2',         cat:'North America',  flag:'🇺🇸', provider:'azure', statusPageUrl:'https://azure.status.microsoft/en-us/status' },
    { id:'az-centralus',       name:'Central US',         code:'centralus',       cat:'North America',  flag:'🇺🇸', provider:'azure', statusPageUrl:'https://azure.status.microsoft/en-us/status' },
    { id:'az-canadacentral',   name:'Canada Central',     code:'canadacentral',   cat:'North America',  flag:'🇨🇦', provider:'azure', statusPageUrl:'https://azure.status.microsoft/en-us/status' },
    { id:'az-brazilsouth',     name:'Brazil South',       code:'brazilsouth',     cat:'South America',     flag:'🇧🇷', provider:'azure', statusPageUrl:'https://azure.status.microsoft/en-us/status' },
    { id:'az-westeurope',      name:'West Europe',        code:'westeurope',      cat:'Europe',         flag:'🇳🇱', provider:'azure', statusPageUrl:'https://azure.status.microsoft/en-us/status' },
    { id:'az-northeurope',     name:'North Europe',       code:'northeurope',     cat:'Europe',         flag:'🇮🇪', provider:'azure', statusPageUrl:'https://azure.status.microsoft/en-us/status' },
    { id:'az-uksouth',         name:'UK South',           code:'uksouth',         cat:'Europe',         flag:'🇬🇧', provider:'azure', statusPageUrl:'https://azure.status.microsoft/en-us/status' },
    { id:'az-francecentral',   name:'France Central',     code:'francecentral',   cat:'Europe',         flag:'🇫🇷', provider:'azure', statusPageUrl:'https://azure.status.microsoft/en-us/status' },
    { id:'az-germanywestc',    name:'Germany West Central', code:'germanywestcentral', cat:'Europe',    flag:'🇩🇪', provider:'azure', statusPageUrl:'https://azure.status.microsoft/en-us/status' },
    { id:'az-swedencentral',   name:'Sweden Central',     code:'swedencentral',   cat:'Europe',         flag:'🇸🇪', provider:'azure', statusPageUrl:'https://azure.status.microsoft/en-us/status' },
    { id:'az-uaenorth',        name:'UAE North',          code:'uaenorth',        cat:'Middle East',  flag:'🇦🇪', provider:'azure', statusPageUrl:'https://azure.status.microsoft/en-us/status' },
    // BUG FIX #1: id 'az-southafricaN' tenía N mayúscula, inconsistente con todos los demás ids.
    // Esto causaba que el toggle de favorito y el historial nunca matchearan este id en storage.
    { id:'az-southafrican',    name:'South Africa North', code:'southafricanorth',cat:'Africa',         flag:'🇿🇦', provider:'azure', statusPageUrl:'https://azure.status.microsoft/en-us/status' },
    { id:'az-eastasia',        name:'East Asia',          code:'eastasia',        cat:'Asia Pacific',  flag:'🇭🇰', provider:'azure', statusPageUrl:'https://azure.status.microsoft/en-us/status' },
    { id:'az-southeastasia',   name:'Southeast Asia',     code:'southeastasia',   cat:'Asia Pacific',  flag:'🇸🇬', provider:'azure', statusPageUrl:'https://azure.status.microsoft/en-us/status' },
    { id:'az-japaneast',       name:'Japan East',         code:'japaneast',       cat:'Asia Pacific',  flag:'🇯🇵', provider:'azure', statusPageUrl:'https://azure.status.microsoft/en-us/status' },
    { id:'az-koreacentral',    name:'Korea Central',      code:'koreacentral',    cat:'Asia Pacific',  flag:'🇰🇷', provider:'azure', statusPageUrl:'https://azure.status.microsoft/en-us/status' },
    { id:'az-centralindia',    name:'Central India',      code:'centralindia',    cat:'Asia Pacific',  flag:'🇮🇳', provider:'azure', statusPageUrl:'https://azure.status.microsoft/en-us/status' },
    { id:'az-australiaeast',   name:'Australia East',     code:'australiaeast',   cat:'Australia & NZ', flag:'🇦🇺', provider:'azure', statusPageUrl:'https://azure.status.microsoft/en-us/status' }
  ];

  var REGIONS = AWS_REGIONS.concat(GCP_REGIONS).concat(AZURE_REGIONS);

  // ─── AWS FETCH ────────────────────────────────────────────────────────────────
  var AWS_CACHE_TTL = 4 * 60 * 1000;
  var _awsStatusCache = null;
  var _awsStatusFetchedAt = 0;
  var AWS_STATUS_STORAGE_KEY = 'cr_aws_cache';

  // ─── GCP FETCH ────────────────────────────────────────────────────────────────
  var GCP_CACHE_TTL = 4 * 60 * 1000;
  var _gcpStatusCache = null;
  var _gcpStatusFetchedAt = 0;
  var GCP_STATUS_STORAGE_KEY = 'cr_gcp_cache';

  // ─── AZURE FETCH ──────────────────────────────────────────────────────────────
  var AZURE_CACHE_TTL = 4 * 60 * 1000;
  var _azureStatusCache = null;
  var _azureStatusFetchedAt = 0;
  var AZURE_STATUS_STORAGE_KEY = 'cr_azure_cache';

  function fetchWithTimeout(url, timeoutMs) {
    var controller = new AbortController();
    var timer = setTimeout(function() { controller.abort(); }, timeoutMs || 15000);
    return fetch(url, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
      headers: { 'Accept': 'application/json, text/plain, */*' }
    }).then(function(r) {
      clearTimeout(timer);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      // BUG FIX #10: mover clearTimeout ANTES de .json() para que cualquier
      // error de parseo no deje el timer activo y dispare un abort espurio.
      return r.json();
    }, function(e) {
      // BUG FIX #10: capturar errores de red/abort también en el rejection handler
      clearTimeout(timer);
      throw e;
    }).catch(function(e) {
      clearTimeout(timer);
      throw e;
    });
  }

  function normalizeAwsData(raw) {
    if (!raw) return { current: [], archive: [] };
    if (Array.isArray(raw.current)) return raw;
    if (Array.isArray(raw)) return { current: raw, archive: [] };
    if (Array.isArray(raw.events)) {
      var evts = raw.events;
      return {
        current: evts.filter(function(e) { return !e.endTime && e.statusCode !== 'resolved'; }),
        archive: evts.filter(function(e) { return  e.endTime || e.statusCode === 'resolved'; })
      };
    }
    if (raw.eventsByRegion && typeof raw.eventsByRegion === 'object') {
      var allEvts = [];
      Object.values(raw.eventsByRegion).forEach(function(arr) {
        if (Array.isArray(arr)) allEvts = allEvts.concat(arr);
      });
      return {
        current: allEvts.filter(function(e) { return !e.endTime && e.statusCode !== 'resolved'; }),
        archive: allEvts.filter(function(e) { return  e.endTime || e.statusCode === 'resolved'; })
      };
    }
    return { current: [], archive: [] };
  }

  function fetchAwsStatus() {
    var now = Date.now();
    if (_awsStatusCache && (now - _awsStatusFetchedAt) < AWS_CACHE_TTL) {
      return Promise.resolve(_awsStatusCache);
    }
    return new Promise(function(resolve) {
      chrome.storage.local.get([AWS_STATUS_STORAGE_KEY], function(s) {
        var persisted = s[AWS_STATUS_STORAGE_KEY];
        if (persisted && persisted.data && (now - persisted.fetchedAt) < AWS_CACHE_TTL) {
          _awsStatusCache = persisted.data;
          _awsStatusFetchedAt = persisted.fetchedAt;
          resolve(persisted.data);
        } else {
          resolve(null);
        }
      });
    }).then(function(cached) {
      if (cached) return cached;
      return fetchWithTimeout('https://status.aws.amazon.com/data.json')
      .catch(function() {
        return fetchWithTimeout('https://health.aws.amazon.com/public/currentevents');
      })
      .then(function(raw) {
        var data = normalizeAwsData(raw);
        _awsStatusCache = data;
        _awsStatusFetchedAt = Date.now();
        var store = {};
        store[AWS_STATUS_STORAGE_KEY] = { data: data, fetchedAt: _awsStatusFetchedAt };
        chrome.storage.local.set(store);
        return data;
      })
      .catch(function() { return { current: [], archive: [] }; });
    });
  }

  // ─── GCP STATUS ───────────────────────────────────────────────────────────────
  function fetchGcpStatus() {
    var now = Date.now();
    if (_gcpStatusCache && (now - _gcpStatusFetchedAt) < GCP_CACHE_TTL) {
      return Promise.resolve(_gcpStatusCache);
    }
    return new Promise(function(resolve) {
      chrome.storage.local.get([GCP_STATUS_STORAGE_KEY], function(s) {
        var persisted = s[GCP_STATUS_STORAGE_KEY];
        if (persisted && persisted.data && (now - persisted.fetchedAt) < GCP_CACHE_TTL) {
          _gcpStatusCache = persisted.data;
          _gcpStatusFetchedAt = persisted.fetchedAt;
          resolve(persisted.data);
        } else { resolve(null); }
      });
    }).then(function(cached) {
      if (cached) return cached;
      return fetchWithTimeout('https://status.cloud.google.com/incidents.json')
      .then(function(raw) {
        var incidents = Array.isArray(raw) ? raw : [];
        var active = incidents.filter(function(inc) {
          return !inc.end || new Date(inc.end) > new Date();
        });
        _gcpStatusCache = active;
        _gcpStatusFetchedAt = Date.now();
        var store = {};
        store[GCP_STATUS_STORAGE_KEY] = { data: active, fetchedAt: _gcpStatusFetchedAt };
        chrome.storage.local.set(store);
        return active;
      })
      .catch(function() { return []; });
    });
  }

  function parseGcpRegionStatus(incidents, regionCode) {
    var rc = regionCode.toLowerCase();
    var active = incidents.filter(function(inc) {
      var desc  = ((inc.external_desc || '') + ' ' + (inc.most_recent_update && inc.most_recent_update.text || '')).toLowerCase();
      var prods = (inc.affected_products || []).map(function(p) { return (p.id + ' ' + p.title).toLowerCase(); }).join(' ');
      return desc.includes(rc) || prods.includes(rc) || desc.includes('all regions') || desc.includes('global');
    });

    var hasMajor = active.some(function(inc) {
      var status = (inc.most_recent_update && inc.most_recent_update.status || '').toLowerCase();
      return status.includes('outage') || status.includes('disruption');
    });
    var hasMinor = active.length > 0 && !hasMajor;
    var status = hasMajor ? 'major' : hasMinor ? 'minor' : 'ok';

    var incidents_out = active.slice(0, 3).map(function(inc) {
      return {
        name:    sanitizeText(inc.external_desc || inc.id || '', 120),
        status:  sanitizeText(inc.most_recent_update && inc.most_recent_update.status || 'Active', 40),
        updated: sanitizeText(inc.most_recent_update && inc.most_recent_update.created || inc.begin || '', 40)
      };
    });

    return {
      status: status,
      description: status === 'ok' ? 'All services operational' : (incidents_out[0] && incidents_out[0].name) || 'Incident detected',
      incidents: incidents_out
    };
  }

  // ─── AZURE STATUS ─────────────────────────────────────────────────────────────
  function fetchAzureStatus() {
    var now = Date.now();
    if (_azureStatusCache && (now - _azureStatusFetchedAt) < AZURE_CACHE_TTL) {
      return Promise.resolve(_azureStatusCache);
    }
    return new Promise(function(resolve) {
      chrome.storage.local.get([AZURE_STATUS_STORAGE_KEY], function(s) {
        var persisted = s[AZURE_STATUS_STORAGE_KEY];
        if (persisted && persisted.data && (now - persisted.fetchedAt) < AZURE_CACHE_TTL) {
          _azureStatusCache = persisted.data;
          _azureStatusFetchedAt = persisted.fetchedAt;
          resolve(persisted.data);
        } else { resolve(null); }
      });
    }).then(function(cached) {
      if (cached) return cached;
      return fetchWithTimeout('https://azure.status.microsoft/api/v2/status')
      .then(function(raw) {
        _azureStatusCache = raw;
        _azureStatusFetchedAt = Date.now();
        var store = {};
        store[AZURE_STATUS_STORAGE_KEY] = { data: raw, fetchedAt: _azureStatusFetchedAt };
        chrome.storage.local.set(store);
        return raw;
      })
      .catch(function() { return {}; });
    });
  }

  function parseAzureRegionStatus(data, regionCode) {
    var rc = regionCode.toLowerCase().replace(/-/g, '');
    var incidents = (data && data.activeEvents) || (data && data.incidents) || [];
    if (!Array.isArray(incidents)) incidents = [];

    var active = incidents.filter(function(inc) {
      var name  = (inc.title || inc.name || '').toLowerCase().replace(/-/g, '');
      var desc  = (inc.summary || inc.impactedServices || '').toLowerCase().replace(/-/g, '');
      var comps = (inc.affectedComponents || inc.impactedRegions || [])
        .map(function(c) { return (c.name || c || '').toLowerCase().replace(/[\s-]/g, ''); })
        .join(' ');
      return name.includes(rc) || desc.includes(rc) || comps.includes(rc) ||
             name.includes('all region') || desc.includes('global');
    });

    var hasMajor = active.some(function(inc) {
      var s = (inc.status || inc.severity || '').toLowerCase();
      return s.includes('critical') || s.includes('major') || s.includes('outage') || s.includes('degraded');
    });
    var hasMinor = active.length > 0 && !hasMajor;
    var status = hasMajor ? 'major' : hasMinor ? 'minor' : 'ok';

    var incidents_out = active.slice(0, 3).map(function(inc) {
      return {
        name:    sanitizeText(inc.title || inc.name || '', 120),
        status:  sanitizeText(inc.status || inc.severity || 'Active', 40),
        updated: sanitizeText(inc.lastModifiedTime || inc.startTime || '', 40)
      };
    });

    return {
      status: status,
      description: status === 'ok' ? 'All services operational' : (incidents_out[0] && incidents_out[0].name) || 'Incident detected',
      incidents: incidents_out
    };
  }

  // ─── AWS PARSER ───────────────────────────────────────────────────────────────
  function parseAwsRegionStatus(data, regionCode) {
    var current = (data && data.current) || [];
    var archive  = (data && data.archive)  || [];
    var all      = current.concat(archive);

    function eventMatchesRegion(ev) {
      var svc  = (ev.service      || '').toLowerCase();
      var sn   = (ev.service_name || '').toLowerCase();
      var sum  = (ev.summary      || '').toLowerCase();
      var reg  = (ev.region       || '').toLowerCase();
      var rc   = regionCode.toLowerCase();
      if (svc.endsWith('-' + rc) || svc === rc) return true;
      if (sn.includes(rc))  return true;
      if (sum.includes(rc)) return true;
      if (reg === rc || reg.includes(rc)) return true;
      var rcNoDash = rc.replace(/-/g, '');
      if (svc.includes(rcNoDash) || sn.includes(rcNoDash)) return true;
      return false;
    }

    function isGlobalEvent(ev) {
      var sn  = (ev.service_name || '').toLowerCase();
      var sum = (ev.summary      || '').toLowerCase();
      var reg = (ev.region       || '').toLowerCase();
      return sn.includes('global') || sn.includes('all region') ||
             sum.includes('global') || reg === 'global';
    }

    var regionEvents = all.filter(eventMatchesRegion);
    var globalEvents = current.filter(isGlobalEvent);

    var currentServiceIds = {};
    current.forEach(function(ev) {
      if (ev.service) currentServiceIds[ev.service] = true;
      if (ev.id)      currentServiceIds[ev.id]      = true;
    });
    var activeRegionEvents = regionEvents.filter(function(ev) {
      return currentServiceIds[ev.service] || currentServiceIds[ev.id];
    });

    var activeEvents = activeRegionEvents.concat(globalEvents);
    var seen = {};
    activeEvents = activeEvents.filter(function(ev) {
      var key = ev.id || ev.service || JSON.stringify(ev);
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });

    function getSeverity(ev) {
      if (typeof ev.status === 'number') return ev.status;
      var code = (ev.statusCode || ev.eventTypeCode || ev.type || '').toLowerCase();
      if (code.includes('operational') || code.includes('resolved')) return 0;
      if (code.includes('degraded') || code.includes('performance') || code.includes('minor')) return 1;
      if (code.includes('partial') || code.includes('major')) return 2;
      if (code.includes('outage') || code.includes('interruption')) return 3;
      return 1;
    }

    var hasMajor = activeEvents.some(function(ev) { var sv = getSeverity(ev); return sv >= 2 && sv !== 4; });
    var hasMinor = activeEvents.some(function(ev) { return getSeverity(ev) === 1 || getSeverity(ev) === 4; });
    var status   = hasMajor ? 'major' : hasMinor ? 'minor' : 'ok';

    var incidents = activeEvents.slice(0, 3).map(function(ev) {
      return {
        name:    sanitizeText(ev.summary || ev.eventTitle || ev.service_name || '', 120),
        status:  sanitizeText(getEventStatusLabel(getSeverity(ev)), 40),
        updated: sanitizeText(ev.date || ev.lastUpdatedTime || ev.startTime || '', 40)
      };
    });

    var desc = status === 'ok'
      ? 'All services operational'
      : (incidents[0] && incidents[0].name) || 'Incident detected';

    return { status: status, description: sanitizeText(desc, 150), incidents: incidents };
  }

  function getEventStatusLabel(s) {
    switch (s) {
      case 0: return 'Informational';
      case 1: return 'Performance degradation';
      case 2: return 'Partial disruption';
      case 3: return 'Service disruption';
      case 4: return 'Service improvement';
      default: return 'Active';
    }
  }

  function sanitizeText(s, maxLen) {
    if (typeof s !== 'string') return '';
    return s.replace(/[<>"'`]/g, '').slice(0, maxLen || 200);
  }

  // ─── CHECK ALL ──────────────────────────────────────────────────────────────
  var BATCH_SIZE = 8;
  var _pendingCheck = false;

  function checkAll(isFirstRun) {
    if (_checkRunning) { _pendingCheck = true; return Promise.resolve(); }
    _checkRunning = true;
    _pendingCheck = false;

    return Promise.all([fetchAwsStatus(), fetchGcpStatus(), fetchAzureStatus()])
    .then(function(results) {
      var awsData   = results[0];
      var gcpData   = results[1];
      var azureData = results[2];
      return checkBatch(0, {}, awsData, gcpData, azureData);
    })
    .then(function(results) {
      return new Promise(function(resolve, reject) {
        chrome.storage.local.get([HISTORY_KEY], function(stored) {
          if (chrome.runtime.lastError) { reject(chrome.runtime.lastError); return; }
          var history = stored[HISTORY_KEY] || {};
          Object.keys(results).forEach(function(id) {
            if (results[id].status) updateHistory(id, results[id].status, history);
          });
          var store = {};
          store[STORAGE_KEY]  = results;
          store[HISTORY_KEY]  = history;
          chrome.storage.local.set(store, function() {
            if (chrome.runtime.lastError) { reject(chrome.runtime.lastError); return; }
            updateBadge(results);
            chrome.runtime.sendMessage(
              { type: 'STATUS_UPDATE', cache: results },
              function() { void chrome.runtime.lastError; }
            );
            _checkRunning = false;
            if (_pendingCheck) checkAll(false);
            resolve(results);
          });
        });
      });
    }).catch(function(err) {
      console.warn('[CloudRadar] checkAll error:', err);
      _checkRunning = false;
      if (_pendingCheck) checkAll(false);
    });
  }

  function checkBatch(idx, acc, awsData, gcpData, azureData) {
    if (idx >= REGIONS.length) return Promise.resolve(acc);
    var batch = REGIONS.slice(idx, idx + BATCH_SIZE);
    var promises = batch.map(function(region) { return checkRegion(region, awsData, gcpData, azureData); });
    return Promise.all(promises).then(function(results) {
      results.forEach(function(r) { if (r) acc[r.id] = r; });
      return checkBatch(idx + BATCH_SIZE, acc, awsData, gcpData, azureData);
    });
  }

  function checkRegion(region, awsData, gcpData, azureData) {
    var parsed;
    if (region.provider === 'gcp') {
      parsed = parseGcpRegionStatus(gcpData, region.code);
    } else if (region.provider === 'azure') {
      parsed = parseAzureRegionStatus(azureData, region.code);
    } else {
      parsed = parseAwsRegionStatus(awsData, region.code);
    }
    return Promise.resolve({
      id:           region.id,
      status:       parsed.status,
      description:  parsed.description,
      incidents:    parsed.incidents,
      statusPageUrl: region.statusPageUrl,
      checkedAt:    Date.now(),
      error:        null
    });
  }

  function updateHistory(id, status, history) {
    var arr = (history[id] || []).slice();
    arr.push({ s: status === 'ok' ? 1 : status === 'minor' ? 2 : status === 'major' ? 3 : status === 'maintenance' ? 4 : 0, t: Date.now() });
    if (arr.length > MAX_HISTORY) arr = arr.slice(arr.length - MAX_HISTORY);
    history[id] = arr;
  }

  // ─── BADGE ──────────────────────────────────────────────────────────────────
  function updateBadge(cache) {
    var major = 0, minor = 0, total = 0;
    Object.values(cache).forEach(function(s) {
      total++;
      if (s.status === 'major') major++;
      else if (s.status === 'minor') minor++;
    });
    var count = major + minor;
    if (count === 0) {
      if (total === 0) {
        chrome.action.setBadgeText({ text: '…' });
        chrome.action.setBadgeBackgroundColor({ color: '#6B7280' });
      } else {
        chrome.action.setBadgeText({ text: '' });
        chrome.action.setBadgeBackgroundColor({ color: '#6B7280' });
      }
    } else {
      chrome.action.setBadgeText({ text: String(count) });
      chrome.action.setBadgeBackgroundColor({ color: major > 0 ? '#EF4444' : '#F59E0B' });
    }
  }

  // ─── ALARM ──────────────────────────────────────────────────────────────────
  // BUG FIX #2: Al instalar/reiniciar, leer el intervalo guardado en storage
  // antes de crear la alarma, para respetar la preferencia del usuario.
  // El código original siempre usaba CHECK_INTERVAL_MINUTES (5) ignorando
  // el valor guardado por SET_INTERVAL.
  chrome.storage.local.get(['cr_interval'], function(s) {
    var mins = s.cr_interval || CHECK_INTERVAL_MINUTES;
    chrome.alarms.create('cr_check', { periodInMinutes: mins });
  });

  chrome.alarms.onAlarm.addListener(function(alarm) {
    if (alarm.name === 'cr_check') checkAll(false);
  });

  // ─── MESSAGES ───────────────────────────────────────────────────────────────
  chrome.runtime.onMessage.addListener(function(msg, _sender, sendResponse) {
    if (msg.type === 'PING') {
      sendResponse({ ok: true });
      return true;
    }
    if (msg.type === 'GET_REGIONS') {
      sendResponse({ regions: REGIONS });
      return true;
    }
    if (msg.type === 'REFRESH') {
      checkAll(false).then(function() {
        chrome.storage.local.get([STORAGE_KEY], function(s) {
          sendResponse({ cache: s[STORAGE_KEY] || {} });
        });
      });
      return true;
    }
    if (msg.type === 'GET_INTERVAL') {
      chrome.storage.local.get(['cr_interval'], function(s) {
        sendResponse({ interval: s.cr_interval || CHECK_INTERVAL_MINUTES });
      });
      return true;
    }
    if (msg.type === 'SET_INTERVAL') {
      var mins = parseInt(msg.interval, 10) || 5;
      chrome.storage.local.set({ cr_interval: mins });
      chrome.alarms.clear('cr_check', function() {
        chrome.alarms.create('cr_check', { periodInMinutes: mins });
      });
      sendResponse({ ok: true });
      return true;
    }
    if (msg.type === 'TOGGLE_FAVORITE') {
      chrome.storage.local.get(['cr_favorites'], function(s) {
        var favs = s.cr_favorites || {};
        if (favs[msg.id]) delete favs[msg.id];
        else favs[msg.id] = true;
        chrome.storage.local.set({ cr_favorites: favs }, function() {
          sendResponse({ favorites: favs });
        });
      });
      return true;
    }
  });

  // ─── INSTALL / STARTUP ──────────────────────────────────────────────────────
  chrome.runtime.onInstalled.addListener(function() { checkAll(true); });
  chrome.runtime.onStartup.addListener(function() { checkAll(false); });

})();
