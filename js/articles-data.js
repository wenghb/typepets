/**
 * TypePets — Articles Data
 * Kid-friendly (ages 7–12) articles for typing practice.
 * Content rules: plain ASCII only (no curly quotes or long dashes) so every character can be
 * typed on a US keyboard; "easy" articles stick to letters, digits, spaces, commas and periods.
 * word_count must match the content (checked by the test harness).
 */

const ARTICLES = [
    {
        id: 1,
        title: "The Amazing Octopus",
        content: "The octopus is one of the smartest animals in the ocean. It has eight arms and three hearts. An octopus can change its colour and texture in less than a second to hide from predators. Some octopuses can even open jars and solve puzzles. They have blue blood and no bones at all, which means they can squeeze through tiny spaces.",
        difficulty: "easy",
        category: "animals",
        word_count: 61
    },
    {
        id: 2,
        title: "How Volcanoes Work",
        content: "Deep under the ground, rock gets so hot that it melts into magma. When pressure builds up, the magma pushes its way to the surface through cracks in the earth. When it erupts, we call it lava. Some volcanoes erupt with a big explosion, while others ooze lava slowly. There are about 1,500 active volcanoes on Earth right now.",
        difficulty: "easy",
        category: "science",
        word_count: 59
    },
    {
        id: 3,
        title: "Life on Mars",
        content: "Mars is the fourth planet from the Sun and is often called the Red Planet because of its rusty soil. A day on Mars is about 24 hours and 37 minutes, almost the same as Earth. Scientists have sent robots called rovers to explore its surface. They found evidence that water once flowed on Mars billions of years ago. One day, humans might visit Mars too.",
        difficulty: "medium",
        category: "space",
        word_count: 66
    },
    {
        id: 4,
        title: "Why Rainbows Appear",
        content: "A rainbow happens when sunlight shines through tiny water droplets in the air. The light bends and splits into seven colours. They are red, orange, yellow, green, blue, indigo, and violet. You can only see a rainbow when the sun is behind you and rain is in front of you. Sometimes you can see a double rainbow, where a second fainter arc appears above the first one.",
        difficulty: "easy",
        category: "science",
        word_count: 67
    },
    {
        id: 5,
        title: "The Kiwi Bird",
        content: "New Zealand is home to the kiwi, a small flightless bird that is the national symbol. Kiwi birds are about the size of a chicken but lay eggs that are huge compared to their body. They are nocturnal, which means they come out at night. Kiwis have whiskers like a cat and nostrils at the tip of their long beak. They can smell worms underground.",
        difficulty: "easy",
        category: "animals",
        word_count: 65
    },
    {
        id: 6,
        title: "The Colour-Changing Chameleon",
        content: "Chameleons are famous for changing colour, but they do not do it just to hide. They change colour to show their mood, regulate body temperature, and communicate with other chameleons. Their eyes can move in two different directions at the same time. Chameleons also have super long tongues that can shoot out faster than you can blink to catch insects.",
        difficulty: "medium",
        category: "animals",
        word_count: 60
    },
    {
        id: 7,
        title: "The All Blacks Haka",
        content: "The New Zealand All Blacks rugby team performs a haka before every match. The haka is a traditional Maori war dance that shows strength and unity. The most famous haka is called Ka Mate, which was written by a Maori chief over 200 years ago. Players stamp their feet, slap their chests, and chant together. It is one of the most iconic moments in sport.",
        difficulty: "medium",
        category: "fun-facts",
        word_count: 65
    },
    {
        id: 8,
        title: "Saturn and Its Rings",
        content: "Saturn is the sixth planet from the Sun and is famous for its beautiful rings. The rings are made of billions of pieces of ice and rock, some as small as a grain of sand and others as big as a house. Saturn is so light that it would float if you could put it in a giant bathtub of water. It has over 140 moons, more than any other planet.",
        difficulty: "medium",
        category: "space",
        word_count: 71
    },
    {
        id: 9,
        title: "Baking Soda Volcano Experiment",
        content: "You can make a mini volcano at home with baking soda and vinegar. Build a cone shape out of clay or sand around a small bottle. Add a few spoons of baking soda into the bottle. Then pour in some vinegar and watch it fizz and overflow like lava. The fizzing happens because the acid in vinegar reacts with the baking soda to create carbon dioxide gas.",
        difficulty: "easy",
        category: "science",
        word_count: 67
    },
    {
        id: 10,
        title: "Ancient Egyptian Pyramids",
        content: "The pyramids of Egypt were built over 4,500 years ago as tombs for pharaohs. The Great Pyramid of Giza was the tallest building in the world for nearly 4,000 years. It is made of about 2.3 million stone blocks, each weighing as much as a car. Nobody knows exactly how the ancient Egyptians moved such heavy stones without modern machines. It remains one of the great mysteries of history.",
        difficulty: "hard",
        category: "history",
        word_count: 69
    },
    {
        id: 11,
        title: "Honeybees at Work",
        content: "Honeybees live together in a big family called a colony. One colony can have thousands of bees. The queen bee lays all the eggs, and the worker bees do almost everything else. Workers collect nectar and pollen from flowers, build wax combs, and keep the hive clean. When a bee finds good flowers, it does a special waggle dance to show the other bees where to fly. Bees turn nectar into honey and store it to eat during the winter.",
        difficulty: "easy",
        category: "animals",
        word_count: 80
    },
    {
        id: 12,
        title: "The Giant Blue Whale",
        content: "The blue whale is the biggest animal that has ever lived. It is even bigger than the largest dinosaurs. A grown blue whale can be longer than two school buses parked end to end. Even so, blue whales eat some of the smallest animals in the sea. They gulp huge mouthfuls of water and tiny shrimp called krill. A blue whale can eat millions of krill in one day. Blue whales also make very loud, deep sounds that can travel far through the ocean.",
        difficulty: "easy",
        category: "animals",
        word_count: 84
    },
    {
        id: 13,
        title: "Our Moon",
        content: "The Moon is our closest neighbor in space. It travels all the way around Earth about once a month. The Moon does not make its own light. It shines because sunlight bounces off it. As the Moon moves, we see different amounts of its sunny side, so it seems to change shape. These shapes are called phases. In 1969, astronauts walked on the Moon for the first time. Their footprints are still there, because there is no wind on the Moon to blow them away.",
        difficulty: "easy",
        category: "space",
        word_count: 85
    },
    {
        id: 14,
        title: "How Plants Make Food",
        content: "Plants can't walk to the kitchen for a snack, so they make their own food. This process is called photosynthesis. A plant's leaves take in sunlight, water from the roots, and a gas called carbon dioxide from the air. Using energy from the sun, the leaves turn these into sugar, which gives the plant energy to grow. While doing this, plants release oxygen into the air. That's great news for us, because people and animals need oxygen to breathe. The green color in leaves comes from chlorophyll, which helps catch the sunlight.",
        difficulty: "medium",
        category: "science",
        word_count: 92
    },
    {
        id: 15,
        title: "The First Airplane Flight",
        content: "On December 17, 1903, two brothers named Orville and Wilbur Wright made history. At Kitty Hawk, North Carolina, their airplane, called the Flyer, lifted off the ground with Orville as the pilot. The first flight lasted only 12 seconds and went about 120 feet. That's shorter than the wings of a jumbo jet! The brothers took turns and made four flights that day. The longest one lasted 59 seconds. Before building planes, the Wright brothers fixed and sold bicycles, and they used what they learned to design their Flyer.",
        difficulty: "medium",
        category: "history",
        word_count: 89
    },
    {
        id: 16,
        title: "Soccer Around the World",
        content: "Soccer is the most popular sport in the world. In many countries it is called football. Each team has eleven players on the field. Players try to kick the ball into the goal of the other team. Only the goalkeeper is allowed to use hands to stop the ball, and only inside a big box near the goal. A soccer game has two halves, and each half is 45 minutes long. The biggest soccer contest is the World Cup, which happens every four years.",
        difficulty: "easy",
        category: "sports",
        word_count: 84
    },
    {
        id: 17,
        title: "What Makes the Weather?",
        content: "Weather is what the air outside is doing right now. It can be sunny, rainy, windy, or snowy. Most weather is powered by the sun. The sun warms the land and the oceans, and warm air rises up into the sky. As the air rises, it cools down, and the water vapor inside it turns into tiny drops that form clouds. When the drops get big and heavy, they fall as rain. If the air is cold enough, they fall as snow instead. Wind happens when air moves from places with high pressure to places with low pressure.",
        difficulty: "medium",
        category: "science",
        word_count: 98
    },
    {
        id: 18,
        title: "The Great Wall of China",
        content: "The Great Wall of China is one of the most famous structures on Earth. It was built over hundreds of years by different rulers who wanted to protect their land. The wall isn't one single wall. It is made of many walls joined together, stretching across mountains, deserts, and grasslands. If you added up all its parts, it would be more than 13,000 miles long! Soldiers kept watch from towers along the wall and sent messages with smoke signals. Some people say you can see the wall from space with just your eyes, but astronauts say that isn't true.",
        difficulty: "medium",
        category: "history",
        word_count: 99
    },
    {
        id: 19,
        title: "Sharks: Ocean Hunters",
        content: "Sharks have been swimming in the oceans for more than 400 million years, so they were around long before the dinosaurs. There are over 500 kinds of sharks. The whale shark is the biggest fish in the world, but it only eats tiny sea creatures called plankton. The smallest sharks can fit in your hand. Sharks don't have bones. Their skeletons are made of cartilage, the same bendy stuff that's in your nose and ears. Sharks lose teeth all the time, but new ones keep moving forward to take their place.",
        difficulty: "medium",
        category: "animals",
        word_count: 91
    },
    {
        id: 20,
        title: "Coral Reefs: Cities Under the Sea",
        content: "Coral reefs look like colorful underwater gardens, but corals are actually animals! Each coral is made of tiny creatures called polyps. The polyps build hard skeletons out of limestone, and over thousands of years these skeletons pile up to form reefs. Reefs cover less than 1% of the ocean floor, yet they're home to about a quarter of all ocean species. The Great Barrier Reef, off the coast of Australia, is the largest reef system in the world; it's so big that astronauts can see it from space. When the water gets too warm, corals can lose their color and turn white. Scientists call this \"coral bleaching.\" Protecting our oceans helps reefs stay healthy.",
        difficulty: "hard",
        category: "animals",
        word_count: 114
    },
    {
        id: 21,
        title: "Hello? The Invention of the Telephone",
        content: "In 1876, Alexander Graham Bell received a patent for the telephone. His first famous words over the wire were to his assistant: \"Mr. Watson, come here, I want to see you.\" Early telephones didn't have buttons or screens. To make a call, you usually picked up the phone and asked an operator to connect you to the right person. Within a few years, thousands of homes and businesses had telephones. Today, billions of people carry tiny phones in their pockets that can also take photos, play music, and find directions. Not bad for an idea that's about 150 years old!",
        difficulty: "hard",
        category: "history",
        word_count: 100
    },
    {
        id: 22,
        title: "The Story of Pizza",
        content: "People have eaten flat breads with toppings for thousands of years, but modern pizza comes from Naples, Italy. In the 1700s and 1800s, pizza was a cheap and tasty food sold on the streets of Naples. A famous story says that in 1889, a pizza maker made a special pizza for Queen Margherita using tomato, mozzarella cheese, and basil. These toppings are red, white, and green, just like the Italian flag. That pizza is still called a Margherita today. Pizza traveled to the United States with Italian families, and now it's loved all around the world.",
        difficulty: "medium",
        category: "fun-facts",
        word_count: 96
    },
    {
        id: 23,
        title: "The Science of Sound",
        content: "Every sound you hear starts with a wiggle. When something vibrates, it pushes on the air around it and makes tiny waves. These sound waves travel through the air and into your ears. Fast vibrations make high sounds, like a whistle or a singing bird. Slow vibrations make low sounds, like a big drum or a tuba. When you pluck a guitar string, it shakes back and forth very quickly. A short, tight string makes a higher note than a long, loose string. Put your hand on your throat and hum, and you can feel your voice box buzzing.",
        difficulty: "easy",
        category: "science",
        word_count: 99
    },
    {
        id: 24,
        title: "Penguins",
        content: "Penguins are birds, but they cannot fly. Instead, they are amazing swimmers. Their wings work like flippers to push them through the water, and their smooth bodies glide like torpedoes. Almost all penguins live in the southern half of the world. The emperor penguin is the tallest kind. Emperor penguin dads keep their egg warm on top of their feet for about two months in the freezing cold, while the moms go to sea to find food. Penguins huddle together in big groups to stay warm when icy winds blow.",
        difficulty: "easy",
        category: "animals",
        word_count: 90
    },
    {
        id: 25,
        title: "The Olympic Games",
        content: "The first Olympic Games were held in ancient Greece more than 2,700 years ago, in a place called Olympia. Back then, there were only a few events, such as running races and wrestling. The modern Olympics began in 1896 in Athens, Greece. Today, athletes from more than 200 countries take part. The Summer Games and the Winter Games each happen every four years. The five rings on the Olympic flag stand for the continents of the world joining together in friendly competition. Winners receive gold medals, second place gets silver, and third place gets bronze.",
        difficulty: "medium",
        category: "sports",
        word_count: 95
    },
    {
        id: 26,
        title: "Our Star, the Sun",
        content: "The Sun is a star, just like the stars you see at night. It looks much bigger and brighter because it is so much closer to us. The Sun is a giant ball of very hot gas. It is so big that more than one million Earths could fit inside it. Light from the Sun takes about eight minutes to reach Earth. Plants use sunlight to grow, and the Sun keeps our planet warm enough for life. Never look straight at the Sun, because its bright light can hurt your eyes.",
        difficulty: "easy",
        category: "space",
        word_count: 91
    }
];
