package com.monkifantasy.cubecode;

import android.content.ContentValues;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.View;
import android.webkit.WebView;
import android.widget.Toast;

import com.getcapacitor.BridgeActivity;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.OutputStream;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Find the WebView and set long-click listener for saving data URL images
        WebView webView = getBridge().getWebView();
        webView.setOnLongClickListener(v -> {
            WebView.HitTestResult result = webView.getHitTestResult();
            int type = result.getType();

            if (type == WebView.HitTestResult.IMAGE_TYPE
                    || type == WebView.HitTestResult.SRC_IMAGE_ANCHOR_TYPE
                    || type == WebView.HitTestResult.IMAGE_ANCHOR_TYPE) {

                String url = result.getExtra();
                if (url != null && url.startsWith("data:image")) {
                    saveDataUrlImage(url);
                    return true;
                }
            }
            return false;
        });
    }

    private void saveDataUrlImage(String dataUrl) {
        try {
            // Extract base64 data: "data:image/png;base64,XXXXX"
            int commaIdx = dataUrl.indexOf(',');
            if (commaIdx < 0) {
                Toast.makeText(this, "Invalid image data", Toast.LENGTH_SHORT).show();
                return;
            }
            String base64 = dataUrl.substring(commaIdx + 1);
            byte[] imageBytes = Base64.decode(base64, Base64.DEFAULT);

            String filename = "cube-code-" + System.currentTimeMillis() + ".png";

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                // Android 10+ — use MediaStore
                ContentValues values = new ContentValues();
                values.put(MediaStore.Images.Media.DISPLAY_NAME, filename);
                values.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
                values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES);
                values.put(MediaStore.Images.Media.IS_PENDING, 1);

                Uri uri = getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
                if (uri != null) {
                    OutputStream os = getContentResolver().openOutputStream(uri);
                    if (os != null) {
                        os.write(imageBytes);
                        os.close();
                    }
                    values.clear();
                    values.put(MediaStore.Images.Media.IS_PENDING, 0);
                    getContentResolver().update(uri, values, null, null);
                    Toast.makeText(this, "图片已保存到相册", Toast.LENGTH_SHORT).show();
                }
            } else {
                // Android 9 and below — direct file write
                String picturesDir = Environment.getExternalStoragePublicDirectory(
                        Environment.DIRECTORY_PICTURES).getAbsolutePath();
                java.io.File file = new java.io.File(picturesDir, filename);
                java.io.FileOutputStream fos = new java.io.FileOutputStream(file);
                fos.write(imageBytes);
                fos.close();

                // Notify media scanner
                sendBroadcast(new android.content.Intent(
                        android.content.Intent.ACTION_MEDIA_SCANNER_SCAN_FILE,
                        Uri.fromFile(file)));
                Toast.makeText(this, "图片已保存到相册", Toast.LENGTH_SHORT).show();
            }
        } catch (IOException e) {
            Toast.makeText(this, "保存失败: " + e.getMessage(), Toast.LENGTH_SHORT).show();
        } catch (Exception e) {
            Toast.makeText(this, "保存失败: " + e.getMessage(), Toast.LENGTH_SHORT).show();
        }
    }
}
