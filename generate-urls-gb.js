import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const blogPostsDir = path.join(__dirname, 'src/pages/blog/posts');
const siteUrl = 'https://www.leadgen-gpt.com';

function getBlogPostUrls() {
    console.log('Scanning blog posts directory...');
    const files = fs.readdirSync(blogPostsDir);
    console.log(`Found ${files.length} blog posts.`);
    return files.map(file => `${siteUrl}/blog/posts/${path.parse(file).name}`);
}

async function submitToIndexNow(urls) {
    const apiKey = '909d02eacbeb4db79775a48c41642530';
    const keyLocation = `${siteUrl}/${apiKey}.txt`;
    const payload = {
        host: siteUrl.replace('https://', ''),
        key: apiKey,
        keyLocation: keyLocation,
        urlList: urls
    };

    const response = await fetch('https://api.indexnow.org/IndexNow', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify(payload),
    });

    if (response.ok) {
        console.log('URLs submitted to IndexNow successfully');
    } else {
        console.error('Error submitting URLs to IndexNow:', response.statusText);
    }
}

async function submitToGoogle(urls) {
    console.log('GOOGLE_APPLICATION_CREDENTIALS:', process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64);

    const serviceAccountBase64 = process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64;
    const serviceAccountJson = Buffer.from(serviceAccountBase64, 'base64').toString('utf-8');
    const serviceAccount = JSON.parse(serviceAccountJson);

    const auth = new GoogleAuth({
        credentials: serviceAccount,
        scopes: ['https://www.googleapis.com/auth/indexing'],
    });

    const authClient = await auth.getClient();
    const indexing = google.indexing({ version: 'v3', auth: authClient });

    const requests = urls.map(url => ({
        url,
        type: 'URL_UPDATED'
    }));

    try {
        for (const request of requests) {
            let retryCount = 0;
            const maxRetries = 3;
            let success = false;

            while (retryCount < maxRetries && !success) {
                try {
                    const response = await indexing.urlNotifications.publish({
                        requestBody: request
                    });
                    console.log('URL submitted to Google successfully:', response.data);
                    success = true;
                } catch (error) {
                    retryCount++;
                    if (retryCount >= maxRetries) {
                        throw error;
                    }
                    console.error(`Retrying (${retryCount}/${maxRetries})...`, error);
                }
            }
        }
    } catch (error) {
        console.error('Error submitting URLs to Google:', error);
    }
}

async function main() {
    const newBlogPostUrls = getBlogPostUrls();
    console.log('New blog post URLs:', newBlogPostUrls);

    if (newBlogPostUrls.length > 0) {
        // await submitToIndexNow(newBlogPostUrls);
        await submitToGoogle(newBlogPostUrls);
    } else {
        console.log('No new blog posts found. Nothing to submit.');
    }
}

main();