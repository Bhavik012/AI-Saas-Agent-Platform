import "server-only";

import { StreamClient } from "@stream-io/node-sdk";

let _streamVideo: StreamClient | null = null;

export const getStreamVideo = (): StreamClient => {
    if (!_streamVideo) {
        const apiKey = process.env.NEXT_PUBLIC_STREAM_VIDEO_API_KEY;
        const secretKey = process.env.STREAM_VIDEO_SECRET_KEY;
        if (!apiKey || !secretKey) {
            throw new Error("Stream Video credentials are not defined in environment variables");
        }
        _streamVideo = new StreamClient(apiKey, secretKey);
    }
    return _streamVideo;
};

export const streamVideo = new Proxy({} as StreamClient, {
    get(_target, prop, receiver) {
        return Reflect.get(getStreamVideo(), prop, receiver);
    },
});
