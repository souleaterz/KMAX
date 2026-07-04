package com.kmax.streaming;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Iterator;
import java.util.Locale;

public class KmaxNative {
    private static final String RD_API = "https://api.real-debrid.com/rest/1.0";
    private final Activity activity;
    private final WebView webView;

    public KmaxNative(Activity activity, WebView webView) {
        this.activity = activity;
        this.webView = webView;
    }

    @JavascriptInterface
    public String version() {
        return "1.0";
    }

    @JavascriptInterface
    public void play(int reqId, String optsJson) {
        activity.runOnUiThread(() -> {
            try {
                JSONObject root = new JSONObject(optsJson);
                Intent intent = new Intent(activity, PlayerActivity.class);
                intent.putExtra("url", root.getString("url"));
                intent.putExtra("title", root.optString("title", "KMAX"));
                intent.putExtra("subtitle", root.optString("subtitle", ""));
                intent.putExtra("startAt", root.optDouble("startAt", 0.0));
                activity.startActivity(intent);
                resolve(reqId, new JSONObject().put("ok", true));
            } catch (Exception e) {
                resolve(reqId, error(e.getMessage()));
            }
        });
    }

    @JavascriptInterface
    public void openExternal(int reqId, String url) {
        activity.runOnUiThread(() -> {
            try {
                Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                activity.startActivity(intent);
                resolve(reqId, new JSONObject().put("ok", true));
            } catch (Exception e) {
                resolve(reqId, error(e.getMessage()));
            }
        });
    }

    @JavascriptInterface
    public void resolveRealDebrid(int reqId, String optsJson) {
        new Thread(() -> {
            try {
                JSONObject opts = new JSONObject(optsJson);
                String apiKey = opts.getString("apiKey").trim();
                String infoHash = opts.getString("infoHash").trim().toLowerCase(Locale.US);
                int fileIdx = opts.optInt("fileIdx", -1);
                String label = opts.optString("label", "Real-Debrid stream");

                JSONArray fileIds = bestFileIds(apiKey, infoHash, fileIdx);
                if (fileIds.length() == 0) {
                    resolve(reqId, error("Real-Debrid has no cached playable file for this source."));
                    return;
                }

                String magnet = "magnet:?xt=urn:btih:" + infoHash;
                JSONObject added = rdPost(apiKey, "/torrents/addMagnet", "magnet=" + enc(magnet));
                String torrentId = added.getString("id");
                rdPostNoBody(apiKey, "/torrents/selectFiles/" + enc(torrentId), "files=" + enc(join(fileIds)));

                JSONObject info = rdGet(apiKey, "/torrents/info/" + enc(torrentId));
                JSONArray links = info.optJSONArray("links");
                if (links == null || links.length() == 0) {
                    resolve(reqId, error("Real-Debrid did not return a playable link."));
                    return;
                }

                JSONObject unrestricted = rdPost(apiKey, "/unrestrict/link", "link=" + enc(links.getString(0)));
                String download = unrestricted.optString("download", "");
                if (download.isEmpty()) {
                    resolve(reqId, error("Real-Debrid could not unrestrict this source."));
                    return;
                }

                JSONObject ok = new JSONObject()
                    .put("ok", true)
                    .put("url", download)
                    .put("label", label)
                    .put("filename", unrestricted.optString("filename", label));
                resolve(reqId, ok);
            } catch (Exception e) {
                resolve(reqId, error(e.getMessage()));
            }
        }).start();
    }

    private JSONArray bestFileIds(String apiKey, String infoHash, int fileIdx) throws Exception {
        JSONObject availability = rdGet(apiKey, "/torrents/instantAvailability/" + enc(infoHash));
        JSONObject hashNode = availability.optJSONObject(infoHash);
        if (hashNode == null) hashNode = availability.optJSONObject(infoHash.toUpperCase(Locale.US));
        JSONArray variants = hashNode == null ? null : hashNode.optJSONArray("rd");
        JSONArray result = new JSONArray();
        if (variants == null) return result;

        String preferred = fileIdx >= 0 ? String.valueOf(fileIdx + 1) : "";
        String bestId = "";
        long bestSize = -1;
        for (int i = 0; i < variants.length(); i++) {
            JSONObject variant = variants.optJSONObject(i);
            if (variant == null) continue;
            Iterator<String> keys = variant.keys();
            while (keys.hasNext()) {
                String id = keys.next();
                JSONObject file = variant.optJSONObject(id);
                if (file == null) continue;
                String name = file.optString("filename", "").toLowerCase(Locale.US);
                if (!isPlayableFile(name)) continue;
                if (id.equals(preferred)) {
                    result.put(id);
                    return result;
                }
                long size = file.optLong("filesize", 0L);
                if (size > bestSize) {
                    bestSize = size;
                    bestId = id;
                }
            }
        }
        if (!bestId.isEmpty()) result.put(bestId);
        return result;
    }

    private boolean isPlayableFile(String name) {
        return name.endsWith(".mkv") || name.endsWith(".mp4") || name.endsWith(".m4v")
            || name.endsWith(".avi") || name.endsWith(".mov") || name.endsWith(".webm")
            || name.endsWith(".m3u8");
    }

    private JSONObject rdGet(String apiKey, String path) throws Exception {
        HttpURLConnection conn = open(apiKey, path, "GET");
        return readJson(conn);
    }

    private JSONObject rdPost(String apiKey, String path, String body) throws Exception {
        HttpURLConnection conn = open(apiKey, path, "POST");
        writeBody(conn, body);
        return readJson(conn);
    }

    private void rdPostNoBody(String apiKey, String path, String body) throws Exception {
        HttpURLConnection conn = open(apiKey, path, "POST");
        writeBody(conn, body);
        readText(conn);
    }

    private HttpURLConnection open(String apiKey, String path, String method) throws Exception {
        HttpURLConnection conn = (HttpURLConnection) new URL(RD_API + path).openConnection();
        conn.setRequestMethod(method);
        conn.setRequestProperty("Authorization", "Bearer " + apiKey);
        conn.setRequestProperty("Accept", "application/json");
        conn.setConnectTimeout(20000);
        conn.setReadTimeout(30000);
        if ("POST".equals(method)) {
            conn.setDoOutput(true);
            conn.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
        }
        return conn;
    }

    private void writeBody(HttpURLConnection conn, String body) throws Exception {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        conn.setFixedLengthStreamingMode(bytes.length);
        try (OutputStream out = conn.getOutputStream()) {
            out.write(bytes);
        }
    }

    private JSONObject readJson(HttpURLConnection conn) throws Exception {
        String text = readText(conn);
        return text.isEmpty() ? new JSONObject() : new JSONObject(text);
    }

    private String readText(HttpURLConnection conn) throws Exception {
        int code = conn.getResponseCode();
        InputStream stream = code >= 200 && code < 300 ? conn.getInputStream() : conn.getErrorStream();
        StringBuilder out = new StringBuilder();
        if (stream != null) {
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) out.append(line);
            }
        }
        if (code < 200 || code >= 300) throw new Exception("Real-Debrid HTTP " + code + ": " + out);
        return out.toString();
    }

    private String enc(String value) throws Exception {
        return URLEncoder.encode(value, "UTF-8");
    }

    private String join(JSONArray array) throws Exception {
        StringBuilder out = new StringBuilder();
        for (int i = 0; i < array.length(); i++) {
            if (i > 0) out.append(',');
            out.append(array.getString(i));
        }
        return out.toString();
    }

    private JSONObject error(String message) {
        try {
            return new JSONObject().put("ok", false).put("error", message == null ? "Native playback failed." : message);
        } catch (Exception ignored) {
            return new JSONObject();
        }
    }

    private void resolve(int reqId, JSONObject payload) {
        activity.runOnUiThread(() ->
            webView.evaluateJavascript(
                "window.__kmaxResolve && window.__kmaxResolve(" + reqId + ", " + JSONObject.quote(payload.toString()) + ")",
                null
            )
        );
    }
}
