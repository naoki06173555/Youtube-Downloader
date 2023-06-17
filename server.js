const express = require('express');
const path = require('path');
const ytdl = require('ytdl-core');
const fs = require('fs');
const NodeID3 = require('node-id3');
const swal = require('sweetalert');

const app = express();
const port = 3000;
const MAX_FILE_SIZE = 12 * 1024 * 1024; // 12MB

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/download', async (req, res, next) => {
  const url = req.body.url;
  const albumName = req.body['album-name'];
  const albumArtist = req.body['album-artist'];
  const artist = req.body.artist;
  const composer = req.body.composer;
  const lyricist = req.body.lyricist;
  const lyrics = req.body.lyrics;
  const title = req.body.title; // タイトルを受け取る

  try {
    const videoInfo = await ytdl.getInfo(url);
    const videoTitle = title || videoInfo.videoDetails.title; // 送信されたタイトルがあれば使用する

    const videoId = videoInfo.videoDetails.videoId;
    const timestamp = Date.now();
    const filename = `${timestamp}_${videoId}.mp3`;

    const audioFilePath = path.join(__dirname, 'temp', filename);
    const taggedAudioFilePath = path.join(__dirname, 'temp', `tagged_${filename}`);

    const audioStream = ytdl(url, { filter: 'audioonly' });

    let fileSize = 0;

    audioStream.on('data', (chunk) => {
      fileSize += chunk.length;
      if (fileSize > MAX_FILE_SIZE) {
        audioStream.destroy(); // ダウンロードをキャンセル
        fs.unlinkSync(audioFilePath); // ファイルを削除
        swal('エラー', 'ファイルサイズが制限を超えています。', 'error'); // アラートを表示
        return res.status(400).send('File size exceeds the limit.'); // エラーレスポンスを返す
      }
    });

    audioStream.pipe(fs.createWriteStream(audioFilePath))
      .on('finish', () => {
        const tags = {
          title: videoTitle,
          album: albumName,
          albumArtist: albumArtist,
          artist: artist,
          composer: composer,
          lyricist: lyricist,
          unsynchronisedLyrics: lyrics
        };

        NodeID3.write(tags, audioFilePath, (error) => {
          if (error) {
            next(error);
          } else {
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.sendFile(audioFilePath, {}, (error) => {
              if (error) {
                next(error);
              } else {
                fs.unlinkSync(audioFilePath);
              }
            });
          }
        });
      })
      .on('error', (error) => {
        next(error);
      });
  } catch (error) {
    next(error);
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
