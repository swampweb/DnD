import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const isValidEmail = (email: string) =>
  /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(email);

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const brevoApiKey = Deno.env.get("BREVO_API_KEY");
  const fromEmail = Deno.env.get("INVITE_FROM_EMAIL");
  const fromName = Deno.env.get("INVITE_FROM_NAME") || "Three Realms Adventures";

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: "Supabase function environment is incomplete." }, 500);
  }

  if (!brevoApiKey || !fromEmail) {
    return json({ error: "Email provider secrets are not configured." }, 500);
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return json({ error: "Authentication is required." }, 401);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });

  const token = authorization.replace("Bearer ", "");
  const { data: userData, error: userError } = await userClient.auth.getUser(token);
  if (userError || !userData.user) {
    return json({ error: "The signed-in session is invalid." }, 401);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("role, display_name")
    .eq("id", userData.user.id)
    .single();

  if (profileError || !profile) {
    return json({ error: "The sender profile could not be verified." }, 403);
  }

  if (!['admin', 'manager'].includes(profile.role)) {
    return json({ error: "Only Admins and Managers can send invitations." }, 403);
  }

  let payload: { email?: string };
  try {
    payload = await request.json();
  } catch {
    return json({ error: "A valid JSON request is required." }, 400);
  }

  const recipientEmail = String(payload.email || "").trim().toLowerCase();
  if (!isValidEmail(recipientEmail)) {
    return json({ error: "Enter a valid email address." }, 400);
  }

  const { data: existingInvite } = await adminClient
    .from("invitations")
    .select("id, status")
    .eq("email", recipientEmail)
    .in("status", ["pending", "sent"])
    .maybeSingle();

  if (existingInvite) {
    return json({ error: "An active invitation already exists for this email address." }, 409);
  }

  const { data: invitation, error: insertError } = await adminClient
    .from("invitations")
    .insert({
      email: recipientEmail,
      invited_by: userData.user.id,
      status: "pending",
      email_provider: "brevo",
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select("id")
    .single();

  if (insertError || !invitation) {
    return json({ error: insertError?.message || "The invitation record could not be created." }, 500);
  }

  const siteUrl = "https://swampweb.github.io/DnD/";
  const senderDisplayName = profile.display_name || "A Three Realms administrator";
  const subject = "You've Been Invited to Three Realms Adventures";

  const htmlContent = `
<!doctype html>
<html>
  <body style="margin:0;background:#0d0c0b;color:#f2e8de;font-family:Arial,sans-serif;">
    <div style="max-width:640px;margin:0 auto;padding:32px 20px;">
      <div style="border:1px solid #a94714;border-radius:14px;overflow:hidden;background:#17130f;">
        <div style="padding:26px;text-align:center;background:linear-gradient(135deg,#28160d,#0e0d0c);">
          <div style="color:#ff8a32;font-size:13px;letter-spacing:3px;text-transform:uppercase;">Three Realms Adventures</div>
          <h1 style="margin:12px 0 4px;color:#f4d5ad;font-family:Georgia,serif;font-size:30px;">Your Adventure Awaits</h1>
          <p style="margin:0;color:#b8aa9c;">An invitation was sent by ${senderDisplayName}.</p>
        </div>
        <div style="padding:28px;line-height:1.6;">
          <p>Welcome to Three Realms Adventures, a tabletop RPG platform where players create universal characters and explore adventures across multiple realms.</p>
          <h2 style="color:#e7bd87;font-family:Georgia,serif;font-size:20px;">Current Realms</h2>
          <ul style="color:#cabdb1;">
            <li>Viking Adventure</li>
            <li>Cajun Adventure, coming soon</li>
            <li>Fantasy Adventure, coming soon</li>
          </ul>
          <h2 style="color:#e7bd87;font-family:Georgia,serif;font-size:20px;">Getting Started</h2>
          <ol style="color:#cabdb1;">
            <li>Open Three Realms Adventures.</li>
            <li>Select Create Account.</li>
            <li>Enter your information and create the account.</li>
            <li>Check your email for a confirmation message from Supabase.</li>
            <li>Open the confirmation link to activate the account.</li>
            <li>Return to Three Realms Adventures and sign in.</li>
          </ol>
          <div style="text-align:center;margin:30px 0 18px;">
            <a href="${siteUrl}" style="display:inline-block;padding:13px 24px;border-radius:9px;background:#b84512;color:#ffffff;text-decoration:none;font-weight:bold;">Open Three Realms Adventures</a>
          </div>
          <p style="color:#9f9388;font-size:13px;text-align:center;">Once signed in, you can create characters, manage your profile, and prepare for future adventures.</p>
        </div>
      </div>
    </div>
  </body>
</html>`;

  const textContent = `Welcome to Three Realms Adventures!\n\nThree Realms Adventures is a tabletop RPG platform where players create universal characters and explore adventures across multiple realms.\n\nCurrent Realms:\n- Viking Adventure\n- Cajun Adventure (Coming Soon)\n- Fantasy Adventure (Coming Soon)\n\nGetting Started:\n1. Visit ${siteUrl}\n2. Select Create Account.\n3. Enter your information and create your account.\n4. Check your email for a confirmation message from Supabase.\n5. Click the confirmation link to activate your account.\n6. Return to Three Realms Adventures and sign in.\n\nOnce logged in, you can create characters, manage your profile, and prepare for future adventures.\n\nThree Realms Adventures\nEndless Adventures`;

  const brevoResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "accept": "application/json",
      "api-key": brevoApiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender: { name: fromName, email: fromEmail },
      to: [{ email: recipientEmail }],
      subject,
      htmlContent,
      textContent,
      tags: ["three-realms-invite"],
    }),
  });

  const providerData = await brevoResponse.json().catch(() => ({}));

  if (!brevoResponse.ok) {
    await adminClient
      .from("invitations")
      .update({
        status: "failed",
        error_message: providerData.message || `Brevo returned ${brevoResponse.status}`,
      })
      .eq("id", invitation.id);

    return json({
      error: providerData.message || "The email provider could not send the invitation.",
      invitationId: invitation.id,
    }, 502);
  }

  await adminClient
    .from("invitations")
    .update({
      status: "sent",
      provider_message_id: providerData.messageId || null,
      sent_at: new Date().toISOString(),
      error_message: null,
    })
    .eq("id", invitation.id);

  return json({
    success: true,
    message: "Invitation sent successfully.",
    invitationId: invitation.id,
  });
});
