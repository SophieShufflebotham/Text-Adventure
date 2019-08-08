//Contains the functionality for gameplay mechanics
var TextAdventure = (function()
{

	//Global variables
    var userInventory = [];
    var userParty = [];
    var dungeonMap = [];
    var currentRoomId = 0;
    var validBattleCommands = [];
    var validNavCommands = [];
    var battleActive = false;
    var firstRunComplete = false;
    var currentBattleTurn = 0;
    var currentEnemy = {};
    var resetInteract = false;
    var gameWin = false;

    function onPageLoad()
    {
        var inputIsValid = false;
        var interactionSuccess = false;
        //TODO move these to separate function
        $("#party-display").hide()
        $("#inventory-display").hide();
        $("#current-room").hide();
        $("#current-battle").hide();
        $('#game-over').hide();
        $('#game-victory').hide();
        $('#victory-title-text').hide();
        $('#art-display').hide();

        initValidCommands();
        NavFunctions.initialiseInteracts();
        $("#input-form").submit(function(event)
        {
            var userInput = document.getElementById("cmd-box").value;
            event.preventDefault();

            document.getElementById("input-form").reset();

            if (!firstRunComplete)
            {
                firstRunComplete = initialSetup(userInput);
                dungeonMap = NavFunctions.generateMap();
                UIFunctions.createRoomDisplay(currentRoomId, dungeonMap);
            }
            else
            {
            	//Validate user input by converting to caps and just taking first letter
            	//Downside is that 'waffles' would be valid navigation to 'west'
            	//But I prefer this to manually hardcoding all possible valid variants
            	userInput = userInput[0].toUpperCase(); 
            	
            	//validateUserInput is a little misleading - it checks directions
            	//But it's likely to break if I try to refactor the function name at this point
                inputIsValid = validateUserInput(userInput);

                if (inputIsValid && battleActive == false)
                {
                    if (userInput == 'I')
                    {
                        interactResult = NavFunctions.checkInteractionType(dungeonMap[currentRoomId].interactId, false, dungeonMap[currentRoomId].interactTarget);

                        if (interactResult == true)
                        {
                            dungeonMap[currentRoomId].interactId = 0;
                            dungeonMap[currentRoomId].interactTarget = {};
                            UIFunctions.createRoomDisplay(currentRoomId, dungeonMap); //Re-display room to remove interaction
                        }
                   }
                    else
                    {
                        moveRooms(userInput, dungeonMap[currentRoomId]);
                    }
                }
                else if (inputIsValid && battleActive == true)
                {
                    processBattleTurn(userInput);
                }
                else
                {
                    alert("Invalid command");
                }

            }
        });
    }

    function moveRooms(direction, currentRoom)
    {
        var currentExits = currentRoom.exits;
        var exitFound = false;
        var newRoomId = null;


        for (var key in currentExits)
        {
            if (key == direction)
            {
                newRoomId = currentExits[key];
                exitFound = true;
                break;
            }
        }

        if (exitFound == false)
        {
            alert("Cannot move in that direction");
        }

        if (newRoomId != currentRoomId && exitFound == true)
        {
            currentRoomId = newRoomId;
            UIFunctions.createRoomDisplay(currentRoomId, dungeonMap);
            
            //Every room movement triggers this, to give a 25% chance of a random battle
            triggerRandomBattle();
        }
    }

    function initValidCommands()
    {
        validNavCommands = NavFunctions.initialiseNavCommands();
        validBattleCommands = BattleFunctions.initialiseBattleCommands();
    }

    function triggerRandomBattle()
    {
        var randInt = Math.floor(Math.floor(Math.random() * 100));

        if ((randInt % 4) == 0) //If random number is divisible by 4
        {
            initiateEnemyEncounter(true, false);
        }
    }

    function validateUserInput(userInput)
    {
        var cmdFound = false;
        var cmdString = "";
        if (!battleActive)
        {
            for (var i = 0; i < validNavCommands.length; i++)
            {
                if (validNavCommands[i] == userInput)
                {
                    cmdFound = true;
                    break;
                }
            }
        }
        else
        {
            for (var i = 0; i < validBattleCommands.length; i++)
            {
                if (validBattleCommands[i] == userInput)
                {
                    cmdFound = true;
                    break;
                }
            }
        }
        return cmdFound;
    }

    function addToInventory(item)
    {
        var success = false;
        
        UIFunctions.createInventoryDisplay(item);
        userInventory.push(item);
        
        $('#item-get-audio')[0].play();
        alert(item.name + " was added to your inventory!");
        success = true;

        return success;
    }

    function addToParty(partyMember)
    {
        var success = false;
        if (userParty.length > 3) //Maximum of 4, like most RPGs
        {
            alert("Party Full");
        }
        else
        {
            UIFunctions.createPartyDisplay(partyMember, false);
            userParty.push(partyMember);
            success = true;
        }
        
        if(success == true && userParty.length > 1)
        {
        	//Set autoplay for this instance to prevent issues with alerts interrupting
        	//playback
        	
        	$("#party-get-audio")[0].autoplay = true;
        	$("#party-get-audio")[0].play();
        	alert(partyMember.name + " has joined the party!");
        }
        return success;
    }

    //TODO this function is a bit gross and could use with tidying up
    function initialSetup(userName)
    {
        var userCharacter = new BattleFunctions.PartyMember(userName);
        userCharacter.isPlayer = true;
        addToParty(userCharacter);
        $("#party-display").show();
        $("#inventory-display").show();
        $("#intro-text").hide();
        $("#art-display").show();

		
        return true;
    }

    function initiateEnemyEncounter(isRandom, isInteract)
    {
        battleActive = true;
        resetInteract = isInteract;
        
        $('#battle-audio')[0].load(); //reload the track
        $('#battle-audio')[0].play();
        
        //isRandom is a variable passed in by the random encounter function
        //To indicate whether an enemy needs to be generated or has been stored in the room data
        if(isRandom)
        {
            currentEnemy = BattleFunctions.createRandomBattle(userParty[0].level);
            UIFunctions.createBattleDisplay(currentEnemy);
        }
        else
        {
            currentEnemy = dungeonMap[currentRoomId].interactTarget;
            UIFunctions.createBattleDisplay(currentEnemy);
        }

        UIFunctions.createBattleTurnDisplay(userParty[currentBattleTurn]);

        return currentEnemy;
    }

    function processBattleTurn(userInput)
    {
        var battleResult = {};
        var enemyAction = "";
        var counter = 0;
        var battleEnd = false;
        var turnActions = {};
        var isFlee = false;

        if (currentBattleTurn <= (userParty.length) - 1) //-1 becuase we're working with 0-3
        {
            battleResult = BattleFunctions.resolveTurn(userInput, userParty[currentBattleTurn], currentEnemy);

            if (battleResult.isDefending == true)
            {
                userParty[currentBattleTurn].isDefending = true;
            }
            else if (battleResult.isAttacked == true)
            {
                currentEnemy.currentHealth = battleResult.attackedHealth;
            }
            else if (battleResult.isHealed == true)
            {
            	if(battleResult.modifier > 0)
            	{
            		//Only overwrite the current health if there was actually an increase
            		userParty[currentBattleTurn].currentHealth = battleResult.healedHealth;
            		userParty[currentBattleTurn].currentMagic = battleResult.healedMagic;          
            	}
            	
              
                do //Do while to ensure the party dispalay reflects the current array
                {
                    if (counter == 0)
                    {
                        UIFunctions.createPartyDisplay(userParty[counter], true);
                    }
                    else
                    {
                        UIFunctions.createPartyDisplay(userParty[counter], false);
                    }
                    counter++
                }
                while (counter < userParty.length)
                
                	counter = 0;
            }
            else if (battleResult.isFlee == true)
            {
            	isFlee = true;
            }
            
            UIFunctions.createBattleDisplay(currentEnemy); //Updates enemy damage
            UIFunctions.createFriendlyActionDisplay(userParty[currentBattleTurn].name, battleResult, currentEnemy.name);
            currentBattleTurn++;
        }

        //Checks that all party members have finished their turns and that the party leader hasn't fled
        //Because otherwise somebody will still get hit and that defeats the whole reason
        //that I even put a flee option in
        
        if (currentBattleTurn == userParty.length && !isFlee)
        {
            currentEnemy.isDefending = false;
            
            //Enemy only needs to attack or defend, otherwise battles could go on forever
            //Due to the RNG only being  pseudo-random
            enemyAction = BattleFunctions.selectEnemyCommand(['A', 'D'], userParty);
            battleResult = BattleFunctions.resolveTurn(enemyAction.action, currentEnemy, userParty[enemyAction.target]);
            

            if (battleResult.isDefending == true)
            {
                currentEnemy.isDefending = true;
            }
            else
            {
                userParty[enemyAction.target].currentHealth = battleResult.attackedHealth;
                battleResult.target = userParty[enemyAction.target];
                do {
                    if (counter == 0)
                    {
                        UIFunctions.createPartyDisplay(userParty[counter], true);
                    }
                    else
                    {
                        UIFunctions.createPartyDisplay(userParty[counter], false);
                    }
                    counter++
                }
                while (counter < userParty.length)
            }

            counter = 0; //reset

            for (var i = 0; i < userParty.length; i++)
            {
                userParty[i].isDefending = false; //reset defend status
            }
            UIFunctions.createEnemyActionDisplay(currentEnemy, battleResult)
            currentBattleTurn = 0;
        }

        //End of every turn calls this to check whether the battle is over
        battleEnd = validateBattleResult(currentEnemy, userParty, isFlee)

        UIFunctions.createBattleTurnDisplay(userParty[currentBattleTurn]); //updates acting party member  
    }

    function validateBattleResult(enemy, userParty, isFlee)
    {
        var continueBattle = true;
        var counter = 0;
        var audioLoad = null;
        
        if (enemy.currentHealth == 0 || isFlee)
        {
        	if(!isFlee)
        	{
        		//These should definitely have been in their own function
        		//But I added them far too late to do that
        		$('#battle-audio')[0].pause();
        		
        		//These play statements sometimes have trouble playing sometimes
        		//I suspect the alert is halting the playback due to the pause in code execution
        		//Even though technically they'd be on separate threads
        		//And there's even a promise so it should wait for the resolve
        		//I'm very salty about this but don't want to switch to jQuery's
        		//async message boxes
        		
        		//Setting autoplay seems to be the only workaround
        		$("#victory-audio")[0].autoplay = true;
        		$("#victory-audio")[0].play().then(alert("Victory!"));
        		

                if(enemy.isBoss)
                {
                	gameWin = true;
                }
        		
                userParty = BattleFunctions.calculateBattleReward(userParty, enemy);
        	}
        	else
        	{
        		alert("You ran away...");
        		$('#battle-audio')[0].pause();
        		resetInteract = false;
        	}

            currentBattleTurn = 0;
            continueBattle = false;
 
            //Removes the interaction from the room if monster was a scripted encounter
            //and is defeated
            
            if(resetInteract)
            {
                dungeonMap[currentRoomId].interactId = 0;
                dungeonMap[currentRoomId].interactTarget = {};
            }

            UIFunctions.createRoomDisplay(currentRoomId, dungeonMap);
            battleActive = false;

            do //Reset the party display to give most up to date information
            {
                if (counter == 0)
                {
                    UIFunctions.createPartyDisplay(userParty[counter], true);
                }
                else
                {
                    UIFunctions.createPartyDisplay(userParty[counter], false);
                }
                counter++
            }
            while (counter < userParty.length)

            counter = 0;
        }

        //Handle removal of party members when HP hits zero
        for (var i = 0; i < userParty.length; i++)
        {
            if (userParty[i].currentHealth == 0)
            {
                if (userParty[i].isPlayer == true)
                {
                    alert("You fell in battle...");
                    gameOver();
                    continueBattle = false;
                }
                else
                {
                    alert(userParty[i].name + " has fallen in battle!");
                    removeFromParty(i);
                    if (currentBattleTurn > 0)
                    {
                        currentBattleTurn--;
                    }
                }
            }
        }
        return continueBattle;
    }

    function removeFromParty(index)
    {
        var counter = 0;
        userParty.splice(index, 1);

        do {
            if (counter == 0)
            {
                UIFunctions.createPartyDisplay(userParty[counter], true);
            }
            else
            {
                UIFunctions.createPartyDisplay(userParty[counter], false);
            }
            counter++
        }
        while (counter < userParty.length)
    }

    function gameOver()
    {
    	$('#battle-audio')[0].pause();
    	$('#game-over-audio')[0].play();
        $('#game-overlay').hide();
        $('#game-over').show();    
    }

    function checkForRequiredItem()
    {
        var lockedExits = dungeonMap[currentRoomId].lockedExit;
        var itemFound = false;
        for (var i = 0; i < userInventory.length; i++)
        {
            if (userInventory[i].id == dungeonMap[currentRoomId].interactTarget.id)
            {
                removeFromInventory(i);

                for (var key in lockedExits)
                {
                    dungeonMap[currentRoomId].exits[key] = lockedExits[key];
                }
                dungeonMap[currentRoomId].interactId = 0;
                dungeonMap[currentRoomId].interactTarget = {};
                UIFunctions.createRoomDisplay(currentRoomId, dungeonMap);
                itemFound = true;
            }
            if (itemFound == true)
            {
                break;
            }
        }

        if(gameWin == true && itemFound == true)
        {
            $("#screen-container").hide();
            $('victory-title').show();
            $('victory-title-text').show();
            $('#game-victory').show();
        }
        
        if (itemFound == false)
        {
            alert("You lack the necessary item");
        }
    }

    function removeFromInventory(index)
    {
        var counter = 0;
        userInventory.splice(index, 1);

        if (userInventory.length > 0)
        {
            do {
                if (counter == 0)
                {
                    UIFunctions.createInventoryDisplay(userInventory[counter], true);
                }
                else
                {
                    UIFunctions.createInventoryDisplay(userInventory[counter], false);
                }
                counter++
            }
            while (counter < userInventory.length)
        }
        else
        {
            $('#inventory-display').text("");
        }
        

    }


    return {
        onPageLoad: onPageLoad,
        addToParty: addToParty,
        addToInventory: addToInventory,
        initiateEnemyEncounter: initiateEnemyEncounter,
        checkForRequiredItem: checkForRequiredItem
    }
})();

//Contains all battle functionality (i.e. enemy/party creation, damage calculation)
var BattleFunctions = (function()
{

    function initialiseBattleCommands()
    {
        var commandArray = ['A', 'D', 'H', 'F']; //TODO add flee option

        return commandArray;
    }

    function Enemy(enemyName, userLevel)
    {
        //TODO alter scaling - not quite right
        var scaler = 0;
        var level = Math.floor(Math.random() * userLevel) + 1;
        scaler += Math.round(level * 0.25);

        var maxHealth = Math.floor(Math.random() * (10 + scaler) + 1);
        var attack = Math.floor(Math.random() * (10 + scaler) + 1);
        
        maxHealth += Math.round(maxHealth*scaler);
        attack += Math.round(attack*scaler);

        this.name = enemyName;
        this.attack = attack; 
        this.maxHealth = maxHealth;
        this.currentHealth = maxHealth;
        this.isDefending = false;
        this.level = level;
        this.isBoss = false;
        //converts the enemy name into an image file name, replacing spaces with a hyphen
        this.image = "./assets/" + (enemyName.toLowerCase()).replace(/\s/g, '-') + ".jpg";
    }

    function PartyMember(charName)
    {
        var maxHealth = Math.floor(Math.random() * 10) + 1;
        var maxMagic = Math.floor(Math.random() * 10) + 1;

        this.name = charName;
        this.attack = Math.floor(Math.random() * 10) + 1;
        this.maxHealth = maxHealth;
        this.currentHealth = maxHealth;
        this.maxMagic = maxMagic;
        this.currentMagic = maxMagic;
        this.isPlayer = false;
        this.isDefending = false;
        this.level = 1;
        
    }

    function calculateDamage(attacker, defender)
    {
    	//TODO have defend mitigate damage rather than stop completely
        var attackerStat = attacker.attack;
        var attackerLevel = attacker.level;
        var defenderHealth = defender.currentHealth;
        var attackDamage = 0;
        var scaler = 0.75;

        if (defender.isDefending == false)
        {
            scaler = Math.round((attacker.attack + attacker.level) * scaler);
            attackDamage = Math.floor(Math.random() * scaler);

            defenderHealth -= attackDamage;

            if (defenderHealth < 0)
            {
                defenderHealth = 0;
            }
        }
        return defenderHealth;
    }

    function createRandomBattle(userLevel)
    {
        var possibleEnemies = ['Slime', 'Goblin', 'Orc'];
        var randomEnemy = new Enemy(possibleEnemies[Math.floor(Math.random() * possibleEnemies.length)], userLevel);

        return randomEnemy;
    }

    function resolveTurn(selectedCommand, actingParty, target)
    {
        var battleResult = {};
        var originalValue = null;

        switch (selectedCommand)
        {
            case 'D':
                battleResult.isDefending = true;
                break;

            case 'A':
            	battleResult.isAttacked = true;
            	originalValue = target.currentHealth;
                battleResult.attackedHealth = calculateDamage(actingParty, target);
                battleResult.modifier = Math.abs(battleResult.attackedHealth - originalValue);
                break;
            case 'H':
            	battleResult.isHealed = true;
            	originalValue = actingParty.currentHealth;
              if(actingParty.currentHealth < (actingParty.maxHealth - 2) && actingParty.currentMagic > 2)
              {
              	battleResult.healedHealth = actingParty.currentHealth + 2; //TODO make random
            		battleResult.healedMagic = actingParty.currentMagic - 2;
            		battleResult.modifier = battleResult.modifier = Math.abs(originalValue - battleResult.healedHealth);
              }
              else
              {
              	battleResult.modifier = 0;
              }

            	break;
            case 'F':
            	if(actingParty.isPlayer)
            	{
                	battleResult.isFlee = true;           		
            	}
            	else
            	{
            		battleResult.triedToFlee = true;
            	}

            	break;
        }
        return battleResult;
    }

    function selectEnemyCommand(battleCommands, userParty)
    {
        var battleCommand = {};
        var commandToSelect = battleCommands[Math.floor(Math.random() * battleCommands.length)];
        var target = Math.floor(Math.random() * userParty.length);

        battleCommand.action = commandToSelect;
        battleCommand.target = target;

        return battleCommand;
    }

    function calculateBattleReward(userParty, enemy)
    {
        var levelGain = (Math.round(enemy.level * 0.25)) + 1;
        var scaler = (Math.round(levelGain * 0.25)) + 1;

        if (scaler == 0)
        {
            scaler = 1;
        }

        for (var i = 0; i < userParty.length; i++)
        {
            userParty[i].level += levelGain;
            userParty[i].attack += scaler;
            userParty[i].maxHealth += scaler;
            userParty[i].currentHealth = userParty[i].maxHealth; //TODO add healing?
        }
        
        if(enemy.isBoss == true)
        {
        	TextAdventure.addToInventory({name:'Mysterious Triangle', id:15});
        }
        
        return userParty;
    }

    return {
        initialiseBattleCommands: initialiseBattleCommands,
        Enemy: Enemy,
        PartyMember: PartyMember,
        resolveTurn: resolveTurn,
        calculateDamage: calculateDamage,
        createRandomBattle: createRandomBattle,
        selectEnemyCommand: selectEnemyCommand,
        calculateBattleReward: calculateBattleReward
    }
})();

//Contains all display functionality (i.e. formats data for display in party box, etc)
var UIFunctions = (function()
{

    function createPartyDisplay(partyMember, redraw)
    {
        var displayString = "";

        if (redraw == true)
        {
            $("#party-display").text("");
        }

        displayString += partyMember.name + "\tLevel: " + partyMember.level;
        displayString += "	\n\tAttack: " + partyMember.attack;
        displayString += "	\n\tHealth: " + partyMember.currentHealth + "/" + partyMember.maxHealth;
        displayString += "	\n\tMP: " + partyMember.currentMagic+ "/" + partyMember.maxMagic;
        displayString += "\n" //New line for next party member

        $("#party-display").append(displayString);
    }

    function createInventoryDisplay(item, redraw)
    {
        var displayString = item.name;

        if (redraw == true)
        {
            $("#inventory-display").text("");
        }

        displayString += '\n';
        $("#inventory-display").append(displayString);
    }

    function createRoomDisplay(currentRoomId, dungeonMap)
    {
        var displayString = "";
        var exits = dungeonMap[currentRoomId].exits
        var roomExits = "";
        var numberOfExits = 0;
        var interactionDisplay = "";
        var currentRoom = dungeonMap[currentRoomId];

        $("#current-battle").hide();

        for (var key in exits)
        {
            roomExits += key;
            numberOfExits++;
            if (numberOfExits < Object.keys(exits).length)
            {
                roomExits += ', ';
            }
        }

        displayString += "Current Room: " + currentRoom.name;
        displayString += "\n" + currentRoom.description;

        if (currentRoom.interactId > 0)
        {
            interactionDisplay = NavFunctions.checkInteractionType(currentRoom.interactId, true, currentRoom.interactTarget);
            displayString += '\n' + interactionDisplay;
        }

        displayString += "\nAvailable Exits: " + roomExits;


        $("#current-room").text(displayString);
        $("#art-display").attr("src", currentRoom.image);
        $("#current-room").show();
    }

    function createBattleDisplay(enemyInfo)
    {
        var displayString = "";

        displayString += "An angry " + enemyInfo.name + " appeared!";
        displayString += "\nLevel: " + enemyInfo.level + "\tHealth: " + enemyInfo.currentHealth + "/" + enemyInfo.maxHealth;

        $("#current-battle").text(displayString);
        $("#current-room").hide();
        $("#current-battle").show();
        $("#art-display").attr("src", enemyInfo.image);
    }

    function createBattleTurnDisplay(currentTurn)
    {
        var displayString = "";

        displayString += "\nWhat will " + currentTurn.name + " do?";
        $("#current-battle").append(displayString);
    }

    function createEnemyActionDisplay(enemy, battleResult)
    {
        var displayString = "";

        if (battleResult.isDefending)
        {
            displayString += "\n" + enemy.name + " is defending!";
        }
        else
        {
        	if(battleResult.modifier != 0)
        	{
        		  displayString += "\n" + enemy.name + " attacked " + battleResult.target.name + " for " + battleResult.modifier + " damage";
        	}
        	else
        	{
        		displayString += "\n" + enemy.name + " attacked " + battleResult.target.name + ", but missed!";
        	}
        }
        
        $("#current-battle").append(displayString);
    }
    
    function createFriendlyActionDisplay(name, battleResult, enemyName)
    {

    	var displayString = "";

        if (battleResult.isDefending)
        {
            displayString += "\n" + name + " is defending!";
        }
        else if(battleResult.isAttacked)
        {
        	if(battleResult.modifier != 0)
        	{
        		 displayString += "\n" + name + " attacked " + enemyName + " for " + battleResult.modifier + " damage";
        	}
        	else
        	{
        		displayString += "\n" + name + " attacked " + enemyName + ", but missed!"
        	}
           
        }
        else if(battleResult.isHealed)
        {
        	if(battleResult.modifier != 0)
          {
          	displayString += "\n" + name + " healed " + battleResult.modifier + " health";
          }
          else
          {
          	displayString += "\n" + name + " tried to heal, but failed!";
          }
        	 
        }
        else if(battleResult.triedToFlee)
        {
        	 displayString += "\n" + name + " tried to run away, but could not leave the party leader!"
        }

        $("#current-battle").append(displayString); 	
    }

    return {
        createPartyDisplay: createPartyDisplay,
        createInventoryDisplay: createInventoryDisplay,
        createRoomDisplay: createRoomDisplay,
        createBattleDisplay: createBattleDisplay,
        createBattleTurnDisplay: createBattleTurnDisplay,
        createEnemyActionDisplay: createEnemyActionDisplay,
        createFriendlyActionDisplay: createFriendlyActionDisplay
    }
})();

//Contains navigation & interaction functions (i.e. creates & parses interactions, creates map)
var NavFunctions = (function()
{

    var itemOptions = [];
    var partyOptions = [];
    var reqItemOptions = [];

    function initialiseNavCommands()
    {
        var commandArray = ["N", "E", "S", "W", "I"];

        return commandArray;
    }

    function initialiseInteracts()
    {
        partyOptions = ['Ben', 'Joe K', 'Joe G', 'James', 'Luke', 'Rhys'];
        itemOptions = [
        {
            name: 'Key',
            id: 1,
            desc: "In here there is a locked door. You will need a key to open it"
        },
        {
            name: 'Stack of Bombs',
            id: 2,
            desc: "You see a small crack in the wall.\n Video game logic dictates that there is a secret passage behind,\n if you can blow it up"
        },
        {
            name: 'Ice Staff',
            id: 3,
            desc: "You see a waterfall blocking an exit. \nIf you can freeze the waterfall, \nyou can go around it"
        }];
    }

    function generateMap()
    {
        //Note: Interactions - 1 = Party, 2 = Item 3 = Locked door 4 = Enemy
        var map = [];
        var entryway = new Room(0, "Entryway", {'W': 1,'E': 2,'N': 3});
        entryway.description = "You stand in a small underground corridor, with various paths to take";
        entryway.interactId = 3;
        entryway.interactTarget = {
        	name: 'Mysterious Triangle', 
          id: 15, 
          desc: "The wall is lined with triangle-shaped gaps"
        }
        map[entryway.id] = entryway;

        var monsterVillage = new Room(1, "Monster Village", {'E': 0 }, 4);
        monsterVillage.description = "You seem to have come across a small village of monsters";
        map[monsterVillage.id] = monsterVillage;
        
        var monsterNest = new Room(2, "Monster Nest", { 'W': 0}, 2);
        monsterNest.description = "You see a small nest. \nThere appears to be no monsters here, for now"
        map[monsterNest.id] = monsterNest;
        
        //TODO splice so item behind door isn't needed to unlock
        var ruinsRoom = new Room(4, "Abandoned Ruins", {'W': 3}, 2);
        ruinsRoom.description = "You see what appears to be the ruins of a vast underground castle. \nIt is impossible to proceed any further into the ruins"
        map[ruinsRoom.id] = ruinsRoom;
        
        var slipperyCorridor = new Room(7, "Slippery Corridor", {'S': 5, 'N': 9}, 2);
        slipperyCorridor.description = "You encounter a narrow corridor. Underfoot is very slippery and treacherous";
        map[slipperyCorridor.id] = slipperyCorridor;

        var mustyCorridor = new Room(3, "Musty Corridor", {'N': 6,'S': 0,'W': 5}, 3, {'E': 4 });
        mustyCorridor.description = "You walk through a narrow corridor. \nNobody else has been here for a long time"
        map[mustyCorridor.id] = mustyCorridor;

        var lakeRoom = new Room(5, "Underground Lake", {'E': 3, 'N': 7}, 3,{ 'W': 8 });
        lakeRoom.description = "You come across a room with a vast lake";
        map[lakeRoom.id] = lakeRoom;

        var wizardRoom = new Room(6, "Abandoned Wizard Hut",{'S': 3}, 4);
        wizardRoom.description = "You see a small hut. It appears as though a wizard lived here at one point.\nIt has since been abandoned";
        map[wizardRoom.id] = wizardRoom;

        var treasureRoom = new Room(8, "Treasure Room",{'E': 5});
        treasureRoom.description = "You didn't know a room like this could exist underground.\nWith gold-plated walls, it's unlike anything you've seen previously";
        treasureRoom.interactId = 2;
        treasureRoom.interactTarget = {
            name: 'Boss Key',
            id: 10,
            desc: "These doors are currently locked. A normal key would just shatter in thse doors though"
        };
        map[treasureRoom.id] = treasureRoom;

        var icyRoom = new Room(9, "Icy Room",{'S': 7,'E': 10}, 1);
        icyRoom.description = "You come across a room filled with ice";
        map[icyRoom.id] = icyRoom;

        var finalCorridor = new Room(10, 'Final Corridor', {'W': 9,'E': 12,'S': 11},0,{'N':14});
        finalCorridor.description = "To the North is a set of majestic doors\nYou feel a powerful presence from behind";
        finalCorridor.interactId = 3;
        finalCorridor.interactTarget = {
            name: 'Boss Key',
            id: 10,
            desc: "These doors are currently locked. A normal key would just shatter in thse doors though"
        };
        
        finalCorridor.lockedExits = {'N': 14};
        map[finalCorridor.id] = finalCorridor;

        var smallCave = new Room(11, "Small Cavern",{'N': 10}, 1);
        smallCave.description = "You peer into the small cavern in front of you";
        map[smallCave.id] = smallCave;

        var warmCorridor = new Room(12, "Warm Corridor", {'W': 10}, 3,{'S': 13});
        warmCorridor.description = "You come across a coridoor that feels warm\nYou aren't too sure why it's so warm";
        map[warmCorridor.id] = warmCorridor;

        var lavaLake = new Room(13, "Lava Lake",{'N': 12}, 1);
        lavaLake.description = "You enter a room with a large crater filled with laval.\nYou can barely stand the heat";
        map[lavaLake.id] = lavaLake;

        var bossRoom = new Room(14, "The Dragon Chamber",
        {'S': 10});
        bossRoom.description = "You cannot see anything in this room, apart from the shadow of a monster. It has an overwhelming presence";
        bossRoom.interactId = 4;
        bossRoom.interactTarget = {
            name: 'Dragon',
            attack: 50,
            isDefending: false,
            maxHealth: 500,
            currentHealth: 500,
            level: 50,
            isBoss: true,
            image: "./assets/dragon.jpg"
        };
        map[bossRoom.id] = bossRoom;

        return map;

    }

    function Room(roomId, roomName, exits, interactionId, lockedExit)
    {
        this.id = roomId;
        this.name = roomName;
        this.exits = exits;
        this.lockedExit = lockedExit;
        this.description = "placeholder description";
        //converts the room name into an image file name, replacing spaces with a hyphen
        this.image = "./assets/" + (roomName.toLowerCase()).replace(/\s/g, '-') + ".jpg";

        if (interactionId)
        {
            this.interactTarget = createRoomInteraction(interactionId);
            this.interactId = interactionId;
        }
        else
        {
            this.interactId = 0;
        }
    }


    function createRoomInteraction(interactionId)
    {
        var randomItem = "";
        var randomName = "";
        var newPartyMember = {};
        var interactionObj = {};
        var requiredItem = {};
        var randomInt = 0;
        var localItemOptions = 1;

        switch (interactionId)
        {
            case 1: //Party Member
                randomInt = Math.floor(Math.random() * partyOptions.length)
                randomName = partyOptions[randomInt];
                partyOptions.splice(randomInt, 1);
                newPartyMember = new BattleFunctions.PartyMember(randomName);
                interactionObj = newPartyMember;
                break;

            case 2: //Inventory Item get
                randomInt = Math.floor(Math.random() * itemOptions.length)
                randomItem = itemOptions[randomInt];
                itemOptions.splice(randomInt, 1);
                reqItemOptions.push(randomItem);
                interactionObj = randomItem;
                break;

            case 3: //Requires item use
                randomInt = Math.floor(Math.random() * reqItemOptions.length);
                requiredItem = reqItemOptions[randomInt];
                reqItemOptions.splice(randomInt, 1);
                interactionObj = requiredItem;
                break;

            case 4: //Battle
                interactionObj = {};
                break;
        }

        return interactionObj;
    }

    function checkInteractionType(interactionType, stringGenerate, interactTarget)
    {
        var interactReturn = false;
        var requiredItemFound = false;
        var variable = 1;
        

        switch (interactionType)
        {

            case 1: //party
                if (!stringGenerate)
                {
                    interactReturn = TextAdventure.addToParty(interactTarget);
                }
                else
                {
                    interactReturn = "Before you stands " + interactTarget.name + ", waiting to join your adventure";
                }
                break;

            case 2: //item get
                if (!stringGenerate)
                {
                    interactReturn = TextAdventure.addToInventory(interactTarget);
                }
                else
                {
                    interactReturn = "Out of the corner of your eye, you see a shiny " + interactTarget.name;
                }
                break;

            case 3: //item needed
                if (!stringGenerate)
                {
                    TextAdventure.checkForRequiredItem();
                }
                else
                {
                    interactReturn = interactTarget.desc;
                }
                break;

            case 4: //battle
                var randomEnemy = true;
                if (!stringGenerate)
                {
                    if (Object.keys(interactTarget).length > 0)
                    {
                        randomEnemy = false;
                    }

                    TextAdventure.initiateEnemyEncounter(randomEnemy, true);
                }
                else
                {
                    interactReturn = "You see a monster patiently waiting for you to attack"
                }
                break;
        }
        return interactReturn;
    }


    return {
        generateMap: generateMap,
        initialiseNavCommands: initialiseNavCommands,
        checkInteractionType: checkInteractionType,
        initialiseInteracts: initialiseInteracts
    }
})();

//Ensure that all relevant data has been loaded before any calls
$(document).ready(function()
{
   TextAdventure.onPageLoad();
});