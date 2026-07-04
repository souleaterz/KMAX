package com.kmax.streaming;

import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.KeyEvent;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.SeekBar;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

import org.videolan.libvlc.LibVLC;
import org.videolan.libvlc.Media;
import org.videolan.libvlc.MediaPlayer;
import org.videolan.libvlc.util.VLCVideoLayout;

import java.util.ArrayList;

public class PlayerActivity extends AppCompatActivity {
    private LibVLC libVLC;
    private MediaPlayer player;
    private VLCVideoLayout videoLayout;
    private View loading;
    private LinearLayout controls;
    private View topBar;
    private SeekBar seek;
    private TextView currentTime;
    private TextView totalTime;
    private Button playPause;
    private long startAtMs;
    private boolean resumed = false;
    private long lengthMs = 0L;

    private final Handler ui = new Handler(Looper.getMainLooper());
    private final Runnable hideControls = () -> setControlsVisible(false);

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_player);
        goImmersive();

        String url = getIntent().getStringExtra("url");
        if (url == null || url.isEmpty()) {
            finish();
            return;
        }
        String title = getIntent().getStringExtra("title");
        String subtitle = getIntent().getStringExtra("subtitle");
        startAtMs = (long) (getIntent().getDoubleExtra("startAt", 0.0) * 1000.0);

        videoLayout = findViewById(R.id.videoLayout);
        loading = findViewById(R.id.loading);
        controls = findViewById(R.id.controls);
        topBar = findViewById(R.id.topBar);
        seek = findViewById(R.id.seek);
        currentTime = findViewById(R.id.currentTime);
        totalTime = findViewById(R.id.totalTime);
        playPause = findViewById(R.id.playPause);

        ((TextView) findViewById(R.id.topTitle)).setText(title == null || title.isEmpty() ? "KMAX" : title);
        ((TextView) findViewById(R.id.loadingTitle)).setText(title == null || title.isEmpty() ? "Loading" : title);
        ((TextView) findViewById(R.id.topSubtitle)).setText(subtitle == null ? "" : subtitle);
        ((TextView) findViewById(R.id.loadingSource)).setText(subtitle == null || subtitle.isEmpty() ? "Preparing stream..." : subtitle);

        wireControls();

        ArrayList<String> args = new ArrayList<>();
        args.add("--no-drop-late-frames");
        args.add("--no-skip-frames");
        args.add("--network-caching=1800");
        args.add("--http-reconnect");
        libVLC = new LibVLC(this, args);
        player = new MediaPlayer(libVLC);
        player.attachViews(videoLayout, null, false, false);

        Media media = new Media(libVLC, Uri.parse(url));
        media.setHWDecoderEnabled(true, false);
        player.setMedia(media);
        media.release();

        player.setEventListener(event -> {
            switch (event.type) {
                case MediaPlayer.Event.Playing:
                    if (!resumed && startAtMs > 0) {
                        player.setTime(startAtMs);
                        resumed = true;
                    }
                    loading.setVisibility(View.GONE);
                    playPause.setText("Pause");
                    scheduleAutoHide();
                    break;
                case MediaPlayer.Event.Paused:
                    playPause.setText("Play");
                    setControlsVisible(true);
                    break;
                case MediaPlayer.Event.LengthChanged:
                    lengthMs = player.getLength();
                    seek.setMax((int) Math.max(0, lengthMs));
                    totalTime.setText(formatTime(lengthMs));
                    break;
                case MediaPlayer.Event.TimeChanged:
                    if (!seek.isFocused()) updateScrubber(player.getTime());
                    break;
                case MediaPlayer.Event.EndReached:
                case MediaPlayer.Event.EncounteredError:
                    finish();
                    break;
            }
        });
        player.play();
    }

    private void wireControls() {
        seek.setKeyProgressIncrement(10000);
        seek.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            @Override public void onProgressChanged(SeekBar bar, int progress, boolean fromUser) {
                if (fromUser && player != null) {
                    player.setTime(progress);
                    currentTime.setText(formatTime(progress));
                    scheduleAutoHide();
                }
            }
            @Override public void onStartTrackingTouch(SeekBar bar) {}
            @Override public void onStopTrackingTouch(SeekBar bar) {}
        });
        playPause.setOnClickListener(v -> {
            if (player != null) {
                if (player.isPlaying()) player.pause(); else player.play();
                scheduleAutoHide();
            }
        });
        findViewById(R.id.rewind).setOnClickListener(v -> { seekBy(-10000); scheduleAutoHide(); });
        findViewById(R.id.forward).setOnClickListener(v -> { seekBy(10000); scheduleAutoHide(); });
    }

    private void seekBy(long deltaMs) {
        if (player == null) return;
        long max = lengthMs > 0 ? lengthMs : Long.MAX_VALUE;
        long next = Math.max(0, Math.min(max, player.getTime() + deltaMs));
        player.setTime(next);
        updateScrubber(next);
    }

    private void updateScrubber(long ms) {
        seek.setProgress((int) Math.max(0, ms));
        currentTime.setText(formatTime(ms));
    }

    private void setControlsVisible(boolean visible) {
        controls.setVisibility(visible ? View.VISIBLE : View.GONE);
        topBar.setVisibility(visible ? View.VISIBLE : View.GONE);
        ui.removeCallbacks(hideControls);
        if (visible) {
            seek.requestFocus();
            scheduleAutoHide();
        }
    }

    private void scheduleAutoHide() {
        ui.removeCallbacks(hideControls);
        ui.postDelayed(hideControls, 4500);
    }

    private String formatTime(long ms) {
        long total = Math.max(0, ms / 1000);
        long h = total / 3600;
        long m = (total % 3600) / 60;
        long s = total % 60;
        return h > 0 ? String.format("%d:%02d:%02d", h, m, s) : String.format("%d:%02d", m, s);
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        if (event.getAction() != KeyEvent.ACTION_DOWN) return super.dispatchKeyEvent(event);
        switch (event.getKeyCode()) {
            case KeyEvent.KEYCODE_BACK:
                if (controls.getVisibility() == View.VISIBLE) {
                    setControlsVisible(false);
                    return true;
                }
                return super.dispatchKeyEvent(event);
            case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE:
            case KeyEvent.KEYCODE_MEDIA_PLAY:
            case KeyEvent.KEYCODE_MEDIA_PAUSE:
            case KeyEvent.KEYCODE_DPAD_CENTER:
            case KeyEvent.KEYCODE_ENTER:
                if (controls.getVisibility() != View.VISIBLE) {
                    setControlsVisible(true);
                    return true;
                }
                scheduleAutoHide();
                break;
            case KeyEvent.KEYCODE_MEDIA_FAST_FORWARD:
                seekBy(10000);
                setControlsVisible(true);
                return true;
            case KeyEvent.KEYCODE_MEDIA_REWIND:
                seekBy(-10000);
                setControlsVisible(true);
                return true;
            case KeyEvent.KEYCODE_DPAD_UP:
            case KeyEvent.KEYCODE_DPAD_DOWN:
            case KeyEvent.KEYCODE_DPAD_LEFT:
            case KeyEvent.KEYCODE_DPAD_RIGHT:
                if (controls.getVisibility() != View.VISIBLE) {
                    setControlsVisible(true);
                    return true;
                }
                scheduleAutoHide();
                break;
        }
        return super.dispatchKeyEvent(event);
    }

    private void goImmersive() {
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        );
    }

    @Override
    protected void onDestroy() {
        ui.removeCallbacks(hideControls);
        if (player != null) {
            player.stop();
            player.detachViews();
            player.release();
            player = null;
        }
        if (libVLC != null) {
            libVLC.release();
            libVLC = null;
        }
        super.onDestroy();
    }
}
