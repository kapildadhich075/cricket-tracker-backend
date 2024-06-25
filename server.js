const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { PrismaClient } = require("@prisma/client");
const cors = require("cors");
const axios = require("axios");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});
const prisma = new PrismaClient();
const API_KEY = process.env.API_KEY;
const ALL_MATCHES_URL = `https://api.cricapi.com/v1/matches?apikey=${API_KEY}&offset=0`;
const CURRENT_MATCHES_URL = `https://api.cricapi.com/v1/currentMatches?apikey=${API_KEY}&offset=0`;

app.use(cors());
app.use(express.json());

const fetchAllMatches = async () => {
  try {
    const response = await axios.get(ALL_MATCHES_URL);
    return response.data.data;
  } catch (error) {
    console.error("Error fetching data from CricAPI:", error);
    return null;
  }
};

const fetchCurrentMatches = async () => {
  try {
    const response = await axios.get(CURRENT_MATCHES_URL);
    return response.data.data;
  } catch (error) {
    console.error("Error fetching current matches from CricAPI:", error);
    return null;
  }
};

const fetchMatchDetails = async (id) => {
  try {
    const response = await axios.get(
      `https://api.cricapi.com/v1/match_info?apikey=${API_KEY}&offset=0&id=${id}`
    );
    return response.data.data;
  } catch (error) {
    console.error("Error fetching match details from CricAPI:", error);
    return null;
  }
};

const updateAllMatches = async () => {
  const matches = await fetchAllMatches();
  if (matches) {
    for (const match of matches) {
      const matchDetails = await fetchMatchDetails(match.id);
      if (matchDetails) {
        const updatedMatch = await prisma.match.upsert({
          where: { id: match.id },
          update: {
            name: matchDetails.name,
            matchType: matchDetails.matchType,
            status: matchDetails.status,
            venue: matchDetails.venue,
            date: matchDetails.date,
            dateTimeGMT: matchDetails.dateTimeGMT,
            team1: matchDetails.teams[0],
            team2: matchDetails.teams[1],
            team1Img: matchDetails.teamInfo[0]?.img || "",
            team2Img: matchDetails.teamInfo[1]?.img || "",
          },
          create: {
            id: match.id,
            name: matchDetails.name,
            matchType: matchDetails.matchType,
            status: matchDetails.status,
            venue: matchDetails.venue,
            date: matchDetails.date,
            dateTimeGMT: matchDetails.dateTimeGMT,
            team1: matchDetails.teams[0],
            team2: matchDetails.teams[1],
            team1Img: matchDetails.teamInfo[0]?.img || "",
            team2Img: matchDetails.teamInfo[1]?.img || "",
          },
        });

        if (matchDetails.score) {
          await prisma.score.deleteMany({ where: { matchId: match.id } }); // Remove old scores if any
          for (const score of matchDetails.score) {
            await prisma.score.create({
              data: {
                matchId: match.id,
                team: score.inning.split(" Inning ")[0],
                inning: parseInt(score.inning.split(" Inning ")[1]),
                runs: score.r,
                wickets: score.w,
                overs: score.o,
              },
            });
          }
        }

        io.emit("match-updated", updatedMatch);
      }
    }
  }
};

const updateCurrentMatches = async () => {
  const matches = await fetchCurrentMatches();
  if (matches) {
    for (const match of matches) {
      const matchDetails = await fetchMatchDetails(match.id);
      if (matchDetails) {
        const updatedMatch = await prisma.match.upsert({
          where: { id: match.id },
          update: {
            name: matchDetails.name,
            matchType: matchDetails.matchType,
            status: matchDetails.status,
            venue: matchDetails.venue,
            date: matchDetails.date,
            dateTimeGMT: matchDetails.dateTimeGMT,
            team1: matchDetails.teams[0],
            team2: matchDetails.teams[1],
            team1Img: matchDetails.teamInfo[0]?.img || "",
            team2Img: matchDetails.teamInfo[1]?.img || "",
          },
          create: {
            id: match.id,
            name: matchDetails.name,
            matchType: matchDetails.matchType,
            status: matchDetails.status,
            venue: matchDetails.venue,
            date: matchDetails.date,
            dateTimeGMT: matchDetails.dateTimeGMT,
            team1: matchDetails.teams[0],
            team2: matchDetails.teams[1],
            team1Img: matchDetails.teamInfo[0]?.img || "",
            team2Img: matchDetails.teamInfo[1]?.img || "",
          },
        });

        if (matchDetails.score) {
          await prisma.score.deleteMany({ where: { matchId: match.id } }); // Remove old scores if any
          for (const score of matchDetails.score) {
            await prisma.score.create({
              data: {
                matchId: match.id,
                team: score.inning.split(" Inning ")[0],
                inning: parseInt(score.inning.split(" Inning ")[1]),
                runs: score.r,
                wickets: score.w,
                overs: score.o,
              },
            });
          }
        }

        io.emit("match-updated", updatedMatch);
      }
    }
  }
};

app.get("/matches", async (req, res) => {
  const matches = await prisma.match.findMany({
    include: { score: true },
  });
  res.json(matches);
});

app.get("/current-matches", async (req, res) => {
  const matches = await prisma.match.findMany({
    where: {
      status: { not: "Match not started" },
    },
    include: { score: true },
  });
  res.json(matches);
});

io.on("connection", (socket) => {
  console.log("a user connected");
  socket.on("disconnect", () => {
    console.log("user disconnected");
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  setInterval(updateAllMatches, 60000); // Fetch all matches data every 60 seconds
  setInterval(updateCurrentMatches, 30000); // Fetch current matches data every 30 seconds
});
