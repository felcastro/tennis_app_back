const Match = require('../models/Match');

function deg2rad(deg) {
    return deg * (Math.PI/180);
}

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    var R = 6371;
    var dLat = deg2rad(lat2 - lat1);
    var dLon = deg2rad(lon2 - lon1);
    var a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c;
    return d;
}

const getMatchesByDistance = async (filters, latLng, maxDistance) => {
    var matches = await Match.find(filters).populate('creator teamOne teamTwo').populate('matchPlace possiblePlaces').sort({matchDate: 1});
    if (latLng && maxDistance) {
        var closeMatches = [];
        matches.filter((match) => {
            for (var i = 0; i < match.possiblePlaces.length; i++) {
                var placeDistance = getDistanceFromLatLonInKm(
                    match.possiblePlaces[i].geo.coordinates[0], 
                    match.possiblePlaces[i].geo.coordinates[1], 
                    latLng[0], 
                    latLng[1]
                );
                if(placeDistance < maxDistance/1000) {
                    closeMatches.push(match);
                    break;
                }
            }
        });
        return closeMatches;
    } else {
        return matches;
    }
}

const createMatch = async (match) => {
    const matchObj = new Match(match);
    return await matchObj.save().then(m => m.populate('creator teamOne teamTwo').populate('matchPlace possiblePlaces').execPopulate());
}

const addPlayerToMatch = async (matchId, playerId, team) => {
    var match = await Match.findOne({_id: matchId, status: 'open', private: false});

    if (!match) {
        return false;
    }
    if (match.numberOfPlayers === 2 && ((team === 1 && match.teamOne.length > 0) || (team === 2 && match.teamTwo.length > 0))) {
        return false;
    }
    if (match.numberOfPlayers === 4 && ((team === 1 && match.teamOne.length > 1) || (team === 2 && match.teamTwo.length > 1))) {
        return false;
    }
    if (match.teamOne.includes(playerId) || match.teamTwo.includes(playerId)) {
        return false;
    }

    addParams = {}

    if (team === 1) {
        addParams.$push = {teamOne: playerId}
    } else {
        addParams.$push = {teamTwo: playerId}
    }

    if (match.numberOfPlayers === 2) {
        addParams.status = 'pending';
    } else if ((match.teamOne.length + match.teamTwo.length) === 3) {
        addParams.status = 'pending';
    }

    await Match.findOneAndUpdate({_id: matchId, status: 'open', private: false}, addParams);

    return true;
}

const removePlayerFromMatch = async (matchId, playerId) => {
    await Match.findOneAndUpdate({_id: matchId, status: {$or: ['open, pending']}}, {$pullAll: {teamOne: [playerId], teamTwo: [playerId]}, status: 'open'});
    return true;
}

const deleteMatch = async (matchId, creatorId) => {
    return await Match.findOneAndDelete({_id: matchId, creator: creatorId, status: {$or: ['open, pending']}});
}

const updateScore = async (matchId, score, creatorId) => {
    var match =  await Match.findOneAndUpdate({_id: matchId, creator: creatorId, status: 'pending'}, {score: score, status: 'closed'});
    return match ? true : false;
}

module.exports.getMatchesByDistance = getMatchesByDistance;
module.exports.addPlayerToMatch = addPlayerToMatch;
module.exports.removePlayerFromMatch = removePlayerFromMatch;
module.exports.createMatch = createMatch;
module.exports.deleteMatch = deleteMatch;
module.exports.updateScore = updateScore;