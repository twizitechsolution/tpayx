package com.tpayx.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        try {
            WebView webView = getBridge().getWebView();
            webView.setWebViewClient(new BridgeWebViewClient(getBridge()) {
                @Override
                public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                    Uri url = request.getUrl();
                    String urlStr = url != null ? url.toString() : "";
                    if (urlStr.startsWith("upi://") || urlStr.startsWith("intent://") || urlStr.startsWith("paytmmp://") || urlStr.startsWith("phonepe://")) {
                        try {
                            Intent intent;
                            if (urlStr.startsWith("intent://")) {
                                intent = Intent.parseUri(urlStr, Intent.URI_INTENT_SCHEME);
                            } else {
                                intent = new Intent(Intent.ACTION_VIEW, url);
                            }
                            intent.addCategory(Intent.CATEGORY_BROWSABLE);
                            intent.setComponent(null);
                            intent.setSelector(null);
                            view.getContext().startActivity(intent);
                            return true;
                        } catch (Exception e) {
                            try {
                                Intent fallback = new Intent(Intent.ACTION_VIEW, url);
                                view.getContext().startActivity(fallback);
                                return true;
                            } catch (Exception ex) {
                                return true;
                            }
                        }
                    }
                    return super.shouldOverrideUrlLoading(view, request);
                }
            });
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
