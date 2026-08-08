import axios from 'axios';
import { prisma } from '@/lib/prisma';

export interface ZohoConfig {
  zohoEnabled: boolean;
  zohoClientId: string;
  zohoClientSecret: string;
  zohoRefreshToken: string;
  zohoAccessToken?: string;
  zohoDomain: string;
  zohoModule: string;
  zohoWebhookUrl?: string;
}

export interface ZohoLeadPayload {
  Company: string;
  Last_Name: string;
  First_Name?: string;
  Email?: string;
  Phone?: string;
  Website?: string;
  City?: string;
  State?: string;
  Country?: string;
  Street?: string;
  Industry?: string;
  Designation?: string;
  No_of_Employees?: number;
  Lead_Source: string;
  Description?: string;
  Rating?: string;
  [key: string]: any;
}

export async function getZohoAccessToken(config: ZohoConfig): Promise<string> {
  const domain = config.zohoDomain || 'com';

  if (config.zohoWebhookUrl && config.zohoWebhookUrl.trim().length > 5) {
    return 'WEBHOOK_MODE';
  }

  if (config.zohoAccessToken && config.zohoAccessToken.trim().length > 10) {
    return config.zohoAccessToken.trim();
  }

  if (!config.zohoRefreshToken || !config.zohoClientId || !config.zohoClientSecret) {
    throw new Error(
      'Zoho CRM OAuth credentials incomplete. Please set Client ID, Client Secret, and Refresh Token.'
    );
  }

  const accountsUrl = `https://accounts.zoho.${domain}/oauth/v2/token`;
  const params = new URLSearchParams({
    refresh_token: config.zohoRefreshToken.trim(),
    client_id: config.zohoClientId.trim(),
    client_secret: config.zohoClientSecret.trim(),
    grant_type: 'refresh_token',
  });

  try {
    const res = await axios.post(accountsUrl, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 12000,
    });

    if (res.data && res.data.access_token) {
      const newAccessToken = res.data.access_token;
      try {
        await prisma.systemSetting.update({
          where: { id: 'default' },
          data: { zohoAccessToken: newAccessToken },
        });
      } catch {}
      return newAccessToken;
    } else if (res.data?.error) {
      throw new Error(`Zoho OAuth Error: ${res.data.error}`);
    }

    throw new Error('Failed to obtain access token from Zoho OAuth endpoint.');
  } catch (err: any) {
    const detail = err.response?.data?.error || err.response?.data || err.message;
    throw new Error(`Zoho Token Refresh Failed: ${typeof detail === 'object' ? JSON.stringify(detail) : detail}`);
  }
}

export async function getZohoConfig(): Promise<ZohoConfig | null> {
  let settings: any = null;
  try {
    settings = await prisma.systemSetting.findUnique({ where: { id: 'default' } });
  } catch {}

  return {
    zohoEnabled: settings?.zohoEnabled ?? false,
    zohoClientId: settings?.zohoClientId || process.env.ZOHO_CLIENT_ID || '',
    zohoClientSecret: settings?.zohoClientSecret || process.env.ZOHO_CLIENT_SECRET || '',
    zohoRefreshToken: settings?.zohoRefreshToken || process.env.ZOHO_REFRESH_TOKEN || '',
    zohoAccessToken: settings?.zohoAccessToken || process.env.ZOHO_ACCESS_TOKEN || '',
    zohoDomain: settings?.zohoDomain || 'com',
    zohoModule: settings?.zohoModule || 'Leads',
    zohoWebhookUrl: settings?.zohoWebhookUrl || process.env.ZOHO_WEBHOOK_URL || '',
  };
}

export async function sendPayloadToZoho(
  payloads: ZohoLeadPayload[],
  config: ZohoConfig
): Promise<{ success: boolean; syncedIds: string[]; rawResponse?: any; error?: string }> {
  if (payloads.length === 0) {
    return { success: true, syncedIds: [] };
  }

  if (config.zohoWebhookUrl && config.zohoWebhookUrl.trim().length > 5) {
    try {
      const res = await axios.post(config.zohoWebhookUrl.trim(), { data: payloads }, { timeout: 15000 });
      return {
        success: true,
        syncedIds: payloads.map((_, i) => `WH_${Date.now()}_${i}`),
        rawResponse: res.data,
      };
    } catch (err: any) {
      return {
        success: false,
        syncedIds: [],
        error: `Zoho Webhook Error: ${err.message}`,
      };
    }
  }

  const token = await getZohoAccessToken(config);
  const domain = config.zohoDomain || 'com';
  const moduleName = config.zohoModule || 'Leads';
  const apiUrl = `https://www.zohoapis.${domain}/crm/v3/${moduleName}/upsert`;

  try {
    const res = await axios.post(
      apiUrl,
      {
        data: payloads,
        duplicate_check_fields: ['Email', 'Company'],
      },
      {
        headers: {
          Authorization: `Zoho-oauthtoken ${token}`,
          'Content-Type': 'application/json',
        },
        timeout: 20000,
      }
    );

    const dataArr = res.data?.data || [];
    const syncedIds: string[] = [];

    for (let i = 0; i < dataArr.length; i++) {
      const item = dataArr[i];
      if (item.status === 'success' && item.details?.id) {
        syncedIds.push(String(item.details.id));
      } else if (item.details?.id) {
        syncedIds.push(String(item.details.id));
      } else {
        syncedIds.push(`ZOHO_REC_${Date.now()}_${i}`);
      }
    }

    return {
      success: true,
      syncedIds,
      rawResponse: res.data,
    };
  } catch (err: any) {
    const detail = err.response?.data || err.message;
    return {
      success: false,
      syncedIds: [],
      error: `Zoho CRM API Error: ${typeof detail === 'object' ? JSON.stringify(detail) : detail}`,
    };
  }
}
