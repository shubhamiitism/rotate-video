'use client';
import React, { useState, useEffect, useRef } from 'react';
import '../styles/styles.css';

const IndexPage = () => {
    const [videoFile, setVideoFile] = useState(null);
    const [videoDuration, setVideoDuration] = useState(null);
    const [loaded, setLoaded] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [downloadLink, setDownloadLink] = useState('');
    const ffmpegRef = useRef(null);

    const handleVideoUpload = (e) => {
        const file = e.target.files[0];
        setVideoFile(file);
        
        // Create a video element to extract the duration
        const videoElement = document.createElement('video');
        videoElement.preload = 'metadata';
        videoElement.onloadedmetadata = () => {
            console.log('Video duration:', videoElement.duration);
            setVideoDuration(videoElement.duration);
        };
        videoElement.src = URL.createObjectURL(file);
        console.log("Video uploaded...");
    };

    useEffect(() => {
        const loadFFmpeg = async () => {
            const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
            const { FFmpeg } = await import('@ffmpeg/ffmpeg');
            const { toBlobURL } = await import('@ffmpeg/util');
            const ffmpeg = new FFmpeg({ 
                log: true,
                corePath: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
                wasmPath: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
                memory: 256 * 1024 * 1024  // 256 MB
            });
            ffmpegRef.current = ffmpeg;

            ffmpeg.on('log', ({ message }) => {
                console.log('FFmpeg log:', message);
                const timeMatch = message.match(/time=\s*(\d+:\d+:\d+\.\d+)/);
                if (timeMatch) {
                    const [hours, minutes, seconds] = timeMatch[1].split(':').map(parseFloat);
                    const totalSeconds = hours * 3600 + minutes * 60 + seconds;
                    console.log('Total seconds processed:', totalSeconds);

                    if (videoDuration) {
                        const progressValue = (totalSeconds / videoDuration) * 100;
                        setProgress(Math.min(progressValue, 100));
                    }
                }
            });

            await ffmpeg.load();
            setLoaded(true);
        };

        loadFFmpeg();
    }, [videoDuration]);

    const triggerDownload = (url, filename) => {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const getFileExtension = (filename) => {
        return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2).toLowerCase();
    };

    const rotateVideo = async (degrees) => {
        if (!videoFile) {
            console.error('No video file uploaded');
            return;
        }

        setProcessing(true);
        setProgress(0);
        try {
            const ffmpeg = ffmpegRef.current;
            const { fetchFile } = await import('@ffmpeg/util');
            await ffmpeg.writeFile('input.mp4', await fetchFile(videoFile));

            const inputFileName = videoFile.name;
            const fileExtension = getFileExtension(inputFileName);
            let transposeValue;

            switch (degrees) {
                case 90:
                    transposeValue = 1;
                    break;
                case 180:
                    transposeValue = 2;
                    break;
                case 270:
                    transposeValue = 3;
                    break;
                default:
                    console.error('Invalid rotation degree');
                    setProcessing(false);
                    return;
            }

            const command = [
                '-i', 'input.mp4',
                '-vf', `transpose=${transposeValue}`,
                `output.${fileExtension}`
            ];
            await ffmpeg.exec(command);

            const data = await ffmpeg.readFile(`output.${fileExtension}`);
            const videoURL = URL.createObjectURL(new Blob([data.buffer], { type: `video/${fileExtension}` }));
            setDownloadLink(videoURL);

            // Automatically trigger download
            triggerDownload(videoURL, `output.${fileExtension}`);
        } catch (error) {
            console.error('Error during FFmpeg command execution:', error);
        }
        setProcessing(false);
        setProgress(100);
    };

    return (
        <div className="container">
            <h1>Rotate Video</h1>
            <div className="upload-container">
                <label htmlFor="video">Upload file:</label>
                <input className="upload-btn" type="file" id="video" accept="video/*" onChange={handleVideoUpload} />
            </div>
            {loaded && (
                <div className="actions">
                    {processing ? (
                        <div>
                            <div className="loader">Processing...</div>
                            <div className="progress-bar">
                                <div className="progress" style={{ width: `${progress}%` }}>
                                    {Math.round(progress)}%
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div>
                            <button className="merge-btn mx-3" onClick={() => rotateVideo(90)}>Rotate 90°</button>
                            <button className="merge-btn mx-3" onClick={() => rotateVideo(180)}>Rotate 180°</button>
                            <button className="merge-btn mx-3" onClick={() => rotateVideo(270)}>Rotate 270°</button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default IndexPage;
