/* eslint-disable prettier/prettier */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export interface TwitchUser {
  id: string;
  login: string;
  displayName: string;
  profileImageUrl: string;
  email?: string;
  isSubscriber?: boolean;
  subTier?: string; // "1000" (Tier 1), "2000" (Tier 2), "3000" (Tier 3), "Prime"
  isFollower?: boolean;
  followedAt?: string;
  badgeUrl?: string;
  isModerator?: boolean;
  modBadgeUrl?: string;
}

/**
  Generate Twitch OAuth 2.0 authorization URL safely server-side.
  The Client Secret never leaves the server.
 */
export const getTwitchAuthUrl = createServerFn({ method: "POST" })
  .inputValidator(z.object({ redirectUri: z.string().url() }))
  .handler(
  async (ctx): Promise<{ url: string }> => {
    const clientId = process.env.TWITCH_CLIENT_ID;
    if (!clientId) {
      throw new Error("TWITCH_CLIENT_ID not configured on the server.");
    }

    const redirectUri = (ctx as unknown as { data: { redirectUri: string } })?.data?.redirectUri ?? "";
    if (!redirectUri) {
      throw new Error("redirectUri is required.");
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "user:read:email user:read:subscriptions user:read:follows moderation:read",
      force_verify: "false",
    });

    const url = `https://id.twitch.tv/oauth2/authorize?${params.toString()}`;
    return { url };
  },
);

/**
  Exchange OAuth code for Twitch user profile, sub, follower & moderator status securely server-side.
 */
export const handleTwitchCallback = createServerFn({ method: "POST" })
  .inputValidator(z.object({ code: z.string().min(1), redirectUri: z.string().url() }))
  .handler(
  async (ctx): Promise<{ user: TwitchUser; token: string }> => {
    const clientId = process.env.TWITCH_CLIENT_ID;
    const clientSecret = process.env.TWITCH_CLIENT_SECRET;
    const channelName = (process.env.TWITCH_CHANNEL || "turkelpop").toLowerCase().trim();

    if (!clientId || !clientSecret) {
      throw new Error("Twitch credentials (Client ID / Secret) not configured.");
    }

    const payload = (ctx as unknown as { data: { code: string; redirectUri: string } })?.data;
    const code = payload?.code ?? "";
    const redirectUri = payload?.redirectUri ?? "";

    if (!code) throw new Error("Authorization code is missing.");

    // 1. Exchange authorization code → user access token
    const tokenParams = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    });

    const tokenRes = await fetch("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenParams.toString(),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error("[Twitch Auth] Token exchange failed:", errText);
      throw new Error(`Token exchange failed: ${tokenRes.status} — ${errText}`);
    }

    const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string; message?: string };
    if (!tokenData.access_token) {
      throw new Error(`Twitch token error: ${tokenData.message || tokenData.error || "unknown"}`);
    }

    const accessToken = tokenData.access_token;
    const headers = {
      "Client-ID": clientId,
      Authorization: `Bearer ${accessToken}`,
    };

    // 2. Fetch user profile from Helix API
    const userRes = await fetch("https://api.twitch.tv/helix/users", { headers });
    if (!userRes.ok) {
      throw new Error("Failed to retrieve Twitch user profile.");
    }

    const userData = (await userRes.json()) as {
      data?: Array<{
        id: string;
        login: string;
        display_name: string;
        profile_image_url: string;
        email?: string;
      }>;
    };

    const profile = userData?.data?.[0];
    if (!profile) {
      throw new Error("Twitch user profile not found.");
    }

    // 3. Fetch broadcaster (channel) ID for turkelpop
    let broadcasterId = "";
    try {
      const bRes = await fetch(`https://api.twitch.tv/helix/users?login=${channelName}`, { headers });
      if (bRes.ok) {
        const bData = (await bRes.json()) as { data?: Array<{ id: string }> };
        broadcasterId = bData?.data?.[0]?.id || "";
      }
    } catch (e) {
      console.warn("[Twitch Auth] Broadcaster lookup failed:", e);
    }

    let isFollower = false;
    let followedAt: string | undefined;
    let isSubscriber = false;
    let subTier: string | undefined;
    let badgeUrl: string | undefined;
    let isModerator = false;
    let modBadgeUrl: string | undefined;

    if (broadcasterId) {
      // Is user the channel owner?
      if (profile.id === broadcasterId || profile.login.toLowerCase() === channelName) {
        isModerator = true;
      }

      // 4. Check if user is a Follower of the channel
      try {
        const followRes = await fetch(
          `https://api.twitch.tv/helix/channels/followed?user_id=${profile.id}&broadcaster_id=${broadcasterId}`,
          { headers }
        );
        if (followRes.ok) {
          const followData = (await followRes.json()) as {
            data?: Array<{ followed_at: string }>;
          };
          if (followData?.data && followData.data.length > 0) {
            isFollower = true;
            followedAt = followData.data[0].followed_at;
          }
        }
      } catch (e) {
        console.warn("[Twitch Auth] Follower check failed:", e);
      }

      // 5. Check if user is a Subscriber to the channel
      try {
        const subRes = await fetch(
          `https://api.twitch.tv/helix/subscriptions/user?broadcaster_id=${broadcasterId}&user_id=${profile.id}`,
          { headers }
        );
        if (subRes.ok) {
          const subData = (await subRes.json()) as {
            data?: Array<{ tier: string; is_gift?: boolean }>;
          };
          if (subData?.data && subData.data.length > 0) {
            isSubscriber = true;
            subTier = subData.data[0].tier; // "1000", "2000", "3000", "Prime"
          }
        }
      } catch (e) {
        console.warn("[Twitch Auth] Subscriber check failed:", e);
      }

      // 6. Check if user is a Moderator of the channel
      if (!isModerator) {
        try {
          const modRes = await fetch(
            `https://api.twitch.tv/helix/moderators?broadcaster_id=${broadcasterId}&user_id=${profile.id}`,
            { headers }
          );
          if (modRes.ok) {
            const modData = (await modRes.json()) as { data?: Array<{ user_id: string }> };
            if (modData?.data && modData.data.length > 0) {
              isModerator = true;
            }
          }
        } catch (e) {
          console.warn("[Twitch Auth] Moderator check failed:", e);
        }
      }

      // 7. Fetch subscriber & moderator badges for the channel
      try {
        const badgeRes = await fetch(
          `https://api.twitch.tv/helix/chat/badges?broadcaster_id=${broadcasterId}`,
          { headers }
        );
        if (badgeRes.ok) {
          const badgeData = (await badgeRes.json()) as {
            data?: Array<{
              set_id: string;
              versions: Array<{ id: string; image_url_2x: string }>;
            }>;
          };
          if (isSubscriber) {
            const subBadgeSet = badgeData?.data?.find((b) => b.set_id === "subscriber");
            if (subBadgeSet?.versions && subBadgeSet.versions.length > 0) {
              badgeUrl = subBadgeSet.versions[0].image_url_2x;
            }
          }
          if (isModerator) {
            const modBadgeSet = badgeData?.data?.find((b) => b.set_id === "moderator");
            if (modBadgeSet?.versions && modBadgeSet.versions.length > 0) {
              modBadgeUrl = modBadgeSet.versions[0].image_url_2x;
            }
          }
        }
      } catch (e) {
        console.warn("[Twitch Auth] Badge lookup failed:", e);
      }
    }

    return {
      user: {
        id: profile.id,
        login: profile.login,
        displayName: profile.display_name,
        profileImageUrl: profile.profile_image_url,
        email: profile.email,
        isSubscriber,
        subTier,
        isFollower,
        followedAt,
        badgeUrl,
        isModerator,
        modBadgeUrl,
      },
      token: accessToken,
    };
  },
);
