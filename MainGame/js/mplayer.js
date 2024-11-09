// ==========================================
// Player
//
// This class contains the code that manages the local player.
// ==========================================

// Mouse event enumeration
MOUSE = {};
MOUSE.DOWN = 1;
MOUSE.UP = 2;
MOUSE.MOVE = 3;

let isPopupShown = false;
let isPopupBall = false;
let isPopupRunner = false;
let isPopupExtra = false;
let isPopupStarkShoot = false;

// Constructor()
// Creates a new local player manager.
function Player() {
    this.isBlockActionFromButton = false;  // Flag for block actions triggered by mobile buttons
    this.blockCountMap = {};
    this.temp = [];
}

// setWorld( world )
// Assign the local player to a world.
Player.prototype.setWorld = function( world ) {
    this.world = world;
    this.world.localPlayer = this;
    this.pos = world.spawnPoint;
    this.velocity = new Vector( 0, 0, 0 );
    this.angles = [ 0, Math.PI, 0 ]; // Yaw (horizontal), Pitch (vertical)
    this.falling = false;
    this.keys = {}; // Tracks key states
    this.buildMaterial = BLOCK.DIRT;
    this.eventHandlers = {};
    this.targetPitch = 0;
    this.targetYaw = 0;
}

// setClient( client )
// Assign the local player to a socket client.
Player.prototype.setClient = function( client ) {
    this.client = client;
}

// setInputCanvas( id )
// Set the canvas the renderer uses for some input operations.
Player.prototype.setInputCanvas = function( id ) {
    var canvas = this.canvas = document.getElementById( id );

    var t = this;
    document.onkeydown = function( e ) { if ( e.target.tagName != "INPUT" ) { t.onKeyEvent( e.keyCode, true ); return false; } }
    document.onkeyup = function( e ) { if ( e.target.tagName != "INPUT" ) { t.onKeyEvent( e.keyCode, false ); return false; } }

    // Handle mouse movements
    document.addEventListener("mousemove", function (e) {
        t.onMouseEvent(e.movementX, e.movementY, MOUSE.MOVE);
        return false;
    }, false);

    // Handle mouse clicks for block actions
    document.addEventListener("mousedown", function( e ) {
        t.onMouseEvent( window.innerWidth/2, window.innerHeight/2, MOUSE.DOWN, e.which == 3 ); // Right click
    });

    document.addEventListener("mouseup", function( e ) {
        t.onMouseEvent( window.innerWidth/2, window.innerHeight/2, MOUSE.UP, e.which == 3 );
    });
}

// setMaterialSelector( id )
// Sets the table with the material selectors.
Player.prototype.setMaterialSelector = function(id) {
    var table = document.getElementById(id);
    var texOffset = 0;
    var currentRow = document.createElement("tr");
    table.appendChild(currentRow);

    var texture_block = ['https://th.bing.com/th/id/OIP.CsRrGC5W0ylAqcB31nHyQwHaHa?w=1200&h=1200&rs=1&pid=ImgDetMain'];

    var cellCount = 0; // Keep track of the number of cells per row

    var block_count = 0;
    for (var mat in BLOCK) {
        if (typeof (BLOCK[mat]) == "object" && BLOCK[mat].spawnable == true) {
            block_count ++;
            var selector = document.createElement("td");
            selector.style.backgroundImage = `url('../blocking/block${block_count}.png')`;
            selector.style.backgroundSize = 'cover'; // Ensure the image covers the cell

            var pl = this;
            selector.material = BLOCK[mat];
            selector.onclick = function() {
                this.style.opacity = "1.0";
                if (pl.prevSelector) {
                    pl.prevSelector.style.opacity = null;
                }
                pl.prevSelector = this;
                pl.buildMaterial = this.material;
            };

            if (mat == "DIRT") {
                this.prevSelector = selector;
                selector.style.opacity = "1.0";
            }

            currentRow.appendChild(selector);
            cellCount++;
            texOffset -= 70;

            // Create a new row after 16 cells
            if (cellCount >= 16) {
                currentRow = document.createElement("tr");
                table.appendChild(currentRow);
                cellCount = 0;
            }
        }
    }
    table.style.display = "none"; // Show the table once populated
};

// on( event, callback )
// Hook a player event.
Player.prototype.on = function( event, callback ) {
    this.eventHandlers[event] = callback;
}

// onKeyEvent( keyCode, down )
// Hook for keyboard input.
Player.prototype.onKeyEvent = function( keyCode, down ) {
    var key = String.fromCharCode( keyCode ).toLowerCase();
    this.keys[key] = down; // Store key states
    this.keys[keyCode] = down;

    // Open chat on "T"
    if ( !down && key == "t" && this.eventHandlers["openChat"] ) this.eventHandlers.openChat();
}

// onMouseEvent( x, y, type, rmb )
// Hook for mouse input.
Player.prototype.onMouseEvent = function( x, y, type, rmb ) {
    // Prevent block actions from touch events on mobile devices
    if (isMobileDevice()) {
        return;  // Ignore mouse events on mobile devices
    }

    if (type == MOUSE.UP) {
        if (event.target.closest("#materialSelector") || event.target.closest("#message_box")) {
            console.log("Click within material selector, block action prevented");
            return;
        }
        if(Math.floor(this.pos.x) > 68 && Math.floor(this.pos.x) < 98 && Math.floor(this.pos.y) > 76 && Math.floor(this.pos.y) < 94){
            console.log("Click within block action area, block action prevented");
            return;
        }
        if(Math.floor(this.pos.x) > 73 && Math.floor(this.pos.x) < 95 && Math.floor(this.pos.y) > 139 && Math.floor(this.pos.y) < 161){
            console.log("Click within block action area, block action prevented");
            return;
        }
    
        this.doBlockAction(x, y, !rmb);
        console.log("Working in condition");
    } else if (type == MOUSE.MOVE) {
        // Update pitch (up-down) and yaw (left-right) for player view
        this.targetYaw += x / 1000;
        this.targetPitch -= y / 1000;
        if (this.targetPitch < -Math.PI / 2) this.targetPitch = -Math.PI / 2;
        if (this.targetPitch > Math.PI / 2) this.targetPitch = Math.PI / 2;
    }
}

// doBlockAction( x, y, destroy )
// Called to perform an action based on the player's block selection and input.
Player.prototype.doBlockAction = function( x, y, destroy ) {
    // Prevent accidental block actions from touch events on mobile
    if (isMobileDevice() && !this.isBlockActionFromButton) {
        return;  // Skip block actions unless triggered from buttons on mobile
    }

    var bPos = new Vector( Math.floor( this.pos.x ), Math.floor( this.pos.y ), Math.floor( this.pos.z ) );
    var block = this.canvas.renderer.pickAt( new Vector( bPos.x - 4, bPos.y - 4, bPos.z - 4 ), new Vector( bPos.x + 4, bPos.y + 4, bPos.z + 4 ), x, y );

    if (block !== false) {
        var obj = this.client ? this.client : this.world;
            if (destroy) {
                obj.setBlock(block.x, block.y, block.z, BLOCK.AIR); // Destroy block
                console.log("Block destroyed.");
            } else {
                obj.setBlock(block.x + block.n.x, block.y + block.n.y, block.z + block.n.z, this.buildMaterial); // Place block
                var placeX = block.x + block.n.x;
                var placeY = block.y + block.n.y;
                var placeZ = block.z + block.n.z;

                // Store block placement data
                this.temp.push([placeX, placeY, placeZ]);
                if (!this.blockCountMap[this.buildMaterial.id]) {
                    this.blockCountMap[this.buildMaterial.id] = [];
                }
                this.blockCountMap[this.buildMaterial.id].push([placeX, placeY, placeZ]);
                
                console.log("Block placed at:", [placeX, placeY, placeZ], "Block count map:", this.blockCountMap);
            }
    }
}

// getEyePos()
// Returns the position of the eyes of the player for rendering.
Player.prototype.getEyePos = function() {
    return this.pos.add( new Vector( 0.0, 0.0, 1.7 ) ); // Height of the player's eyes
}


// update()
// Updates this local player (gravity, movement)

Player.prototype.update = function() {
    var world = this.world;
    var velocity = this.velocity;
    var pos = this.pos;
    var bPos = new Vector( Math.floor( pos.x ), Math.floor( pos.y ), Math.floor( pos.z ) );

    if ( this.lastUpdate != null ) {
        var delta = ( new Date().getTime() - this.lastUpdate ) / 1000;

        // Update the view angles (pitch and yaw)
        this.angles[0] += ( this.targetPitch - this.angles[0] ) * 30 * delta;
        this.angles[1] += ( this.targetYaw - this.angles[1] ) * 30 * delta;

        // Gravity
        if ( this.falling ) {
            velocity.z += -0.5; // Apply gravity
        }

        // Jumping (Spacebar)
        if ( this.keys[" "] && !this.falling ) {
            velocity.z = 10; // Jump velocity
        }

        // Walking (WASD keys)
        var walkVelocity = new Vector( 0, 0, 0 );
        if ( !this.falling ) {
            if ( this.keys["w"] ) {
                walkVelocity.x += Math.cos( Math.PI / 2 - this.angles[1] );
                walkVelocity.y += Math.sin( Math.PI / 2 - this.angles[1] );
            }
            if ( this.keys["s"] ) {
                walkVelocity.x += Math.cos( Math.PI + Math.PI / 2 - this.angles[1] );
                walkVelocity.y += Math.sin( Math.PI + Math.PI / 2 - this.angles[1] );
            }
            if ( this.keys["a"] ) {
                walkVelocity.x += Math.cos( Math.PI / 2 + Math.PI / 2 - this.angles[1] );
                walkVelocity.y += Math.sin( Math.PI / 2 + Math.PI / 2 - this.angles[1] );
            }
            if ( this.keys["d"] ) {
                walkVelocity.x += Math.cos( -Math.PI / 2 + Math.PI / 2 - this.angles[1] );
                walkVelocity.y += Math.sin( -Math.PI / 2 + Math.PI / 2 - this.angles[1] );
            }
        }

        // Normalize walk velocity
        if ( walkVelocity.length() > 0 ) {
            walkVelocity = walkVelocity.normal();
            velocity.x = walkVelocity.x * 4; // Set speed
            velocity.y = walkVelocity.y * 4;
        } else {
            velocity.x /= this.falling ? 1.01 : 1.5; // Reduce velocity gradually
            velocity.y /= this.falling ? 1.01 : 1.5;
        }

        // Check if player's position meets the condition for popup
        if (this.pos.x >= 83 && this.pos.x <= 87 && this.pos.y >= 150 && this.pos.y <= 155 && this.pos.z === 16 ) {
            // Show the popup only once
            if (!isPopupShown) {
                const iframePopup = document.getElementById('iframePopup');
                iframePopup.style.display = 'block';
                isPopupShown = true;  // Set the flag so that popup only shows once
            }
        } else {
            // Reset the flag once the player leaves the area
            isPopupShown = false;
        }

        console.log("x :",this.pos.x,"y : ", this.pos.y, "z :", this.pos.z)
        // console.log(Math.floor(this.pos.x), Math.floor(this.pos.y), Math.floor(this.pos.z))
        
            
        // Check if player's position meets the condition for popup
        if (Math.floor(this.pos.x) === 72 && Math.floor(this.pos.y)=== 79 && Math.floor(this.pos.z) === 16) {
            if (!isPopupStarkShoot) {
                const iframePopup = document.getElementById('iframePopupStarkShoot');
                iframePopup.style.display = 'block';
                isPopupStarkShoot = true; 
            }
        } else {
            isPopupStarkShoot = false;
        }

        if (Math.floor(this.pos.x) === 72 && Math.floor(this.pos.y)=== 89 && Math.floor(this.pos.z) === 16) {
            if (!isPopupBall) {
                const iframePopup = document.getElementById('iframePopupBall');
                iframePopup.style.display = 'block';
                isPopupBall = true;
            }
        } else {
            isPopupBall = false;
        }

        console.log("up of function", Math.floor(this.pos.x) === 94 && Math.floor(this.pos.y)=== 92 && Math.floor(this.pos.z) === 16)
        if (Math.floor(this.pos.x) === 94 && Math.floor(this.pos.y)=== 92 && Math.floor(this.pos.z) === 16) {
            console.log(isPopupRunner, isPopupRunner)
            if (!isPopupRunner) {
                console.log("opened...!ss")
                const iframePopup1 = document.getElementById('iframePopupRunner');
                iframePopup1.style.display = 'block';
                isPopupRunner = true;
            }
        } else {
            isPopupRunner = false;
        }

        if (Math.floor(this.pos.x) === 94 && Math.floor(this.pos.y)=== 79 && Math.floor(this.pos.z) === 16) {
            if (!isPopupExtra) {
                const iframePopup = document.getElementById('iframePopupExtra');
                iframePopup.style.display = 'block';
                isPopupExtra = true;
            }
        } else {
            isPopupExtra = false;
        }

        // Resolve collisions
        this.pos = this.resolveCollision( pos, bPos, velocity.mul( delta ) );
    }

    this.lastUpdate = new Date().getTime();
}


// resolveCollision( pos, bPos, velocity )
// Resolves collisions between the player and blocks on XY level for the next movement step.
Player.prototype.resolveCollision = function( pos, bPos, velocity ) {
    var world = this.world;
    var playerRect = { x: pos.x + velocity.x, y: pos.y + velocity.y, size: 0.25 };

    // Collect XY collision sides
    var collisionCandidates = [];

    for ( var x = bPos.x - 1; x <= bPos.x + 1; x++ ) {
        for ( var y = bPos.y - 1; y <= bPos.y + 1; y++ ) {
            for ( var z = bPos.z; z <= bPos.z + 1; z++ ) {
                if ( world.getBlock( x, y, z ) != BLOCK.AIR ) {
                    if ( world.getBlock( x - 1, y, z ) == BLOCK.AIR ) collisionCandidates.push( { x: x, dir: -1, y1: y, y2: y + 1 } );
                    if ( world.getBlock( x + 1, y, z ) == BLOCK.AIR ) collisionCandidates.push( { x: x + 1, dir: 1, y1: y, y2: y + 1 } );
                    if ( world.getBlock( x, y - 1, z ) == BLOCK.AIR ) collisionCandidates.push( { y: y, dir: -1, x1: x, x2: x + 1 } );
                    if ( world.getBlock( x, y + 1, z ) == BLOCK.AIR ) collisionCandidates.push( { y: y + 1, dir: 1, x1: x, x2: x + 1 } );
                }
            }
        }
    }

    // Solve XY collisions
    for( var i in collisionCandidates ) {
        var side = collisionCandidates[i];

        if ( lineRectCollide( side, playerRect ) ) {
            if ( side.x != null && velocity.x * side.dir < 0 ) {
                pos.x = side.x + playerRect.size / 2 * ( velocity.x > 0 ? -1 : 1 );
                velocity.x = 0;
            } else if ( side.y != null && velocity.y * side.dir < 0 ) {
                pos.y = side.y + playerRect.size / 2 * ( velocity.y > 0 ? -1 : 1 );
                velocity.y = 0;
            }
        }
    }

    var playerFace = { x1: pos.x + velocity.x - 0.125, y1: pos.y + velocity.y - 0.125, x2: pos.x + velocity.x + 0.125, y2: pos.y + velocity.y + 0.125 };
    var newBZLower = Math.floor( pos.z + velocity.z );
    var newBZUpper = Math.floor( pos.z + 1.7 + velocity.z * 1.1 );

    // Collect Z collision sides
    collisionCandidates = [];

    for ( var x = bPos.x - 1; x <= bPos.x + 1; x++ ) {
        for ( var y = bPos.y - 1; y <= bPos.y + 1; y++ ) {
            if ( world.getBlock( x, y, newBZLower ) != BLOCK.AIR )
                collisionCandidates.push( { z: newBZLower + 1, dir: 1, x1: x, y1: y, x2: x + 1, y2: y + 1 } );
            if ( world.getBlock( x, y, newBZUpper ) != BLOCK.AIR )
                collisionCandidates.push( { z: newBZUpper, dir: -1, x1: x, y1: y, x2: x + 1, y2: y + 1 } );
        }
    }

    // Solve Z collisions
    this.falling = true;
    for ( var i in collisionCandidates ) {
        var face = collisionCandidates[i];

        if ( rectRectCollide( face, playerFace ) && velocity.z * face.dir < 0 ) {
            if ( velocity.z < 0 ) {
                this.falling = false;
                pos.z = face.z;
                velocity.z = 0;
                this.velocity.z = 0;
            } else {
                pos.z = face.z - 1.8;
                velocity.z = 0;
                this.velocity.z = 0;
            }

            break;
        }
    }

    // Return solution
    return pos.add( velocity );
}
