// تست کامل InnerTube ANDROID_VR: فرمت‌های muxed و adaptive
const ctx = {
  clientName: 'ANDROID_VR',
  clientVersion: '1.60.19',
  deviceMake: 'Oculus',
  deviceModel: 'Quest 3',
  androidSdkVersion: 32,
  osName: 'Android',
  osVersion: '12L',
  hl: 'en',
  gl: 'US',
};

const ids = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['dQw4w9WgXcQ', '9bZkp7q19f0', 'JGwWNGJdvx8'];

for (const vid of ids) {
  try {
    const r = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        context: { client: ctx },
        videoId: vid,
        contentCheckOk: true,
        racyCheckOk: true,
      }),
    });
    const d = await r.json();
    console.log(
      `\n▶ ${vid} ${d.playabilityStatus?.status} | ${d.videoDetails?.lengthSeconds}s | ${d.videoDetails?.title?.slice(0, 40)}`
    );
    for (const f of d.streamingData?.formats ?? []) {
      console.log(
        `  MUXED itag=${f.itag} ${(f.mimeType ?? '').split(';')[0]} ${f.qualityLabel} ${(Number(f.contentLength ?? 0) / 1048576).toFixed(1)}MB url=${!!f.url}`
      );
    }
    const vids = (d.streamingData?.adaptiveFormats ?? [])
      .filter((x) => (x.mimeType ?? '').startsWith('video/'))
      .sort((a, b) => (b.height ?? 0) - (a.height ?? 0));
    for (const f of vids.slice(0, 3)) {
      console.log(
        `  adaptive-video itag=${f.itag} ${f.qualityLabel} ${(f.mimeType ?? '').split(';')[0]} url=${!!f.url}`
      );
    }
  } catch (e) {
    console.log(`▶ ${vid} ERR ${e.message}`);
  }
}
